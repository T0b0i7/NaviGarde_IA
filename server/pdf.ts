import zlib from "node:zlib";

export type PdfImageInput = { data: Buffer; mime?: string; caption?: string };

type DecodedImage = {
  width: number;
  height: number;
  payload: Buffer;
  filter: "DCTDecode" | "FlateDecode";
  colorSpace: "DeviceRGB" | "DeviceGray";
  caption?: string;
};

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

function toWinAnsi(value: string): string {
  return value
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, " ");
}

function escapePdfText(value: string): string {
  return toWinAnsi(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function jpegSize(buffer: Buffer): { width: number; height: number; channels: number } | null {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buffer.length) {
    if (buffer[i] !== 0xff) { i += 1; continue; }
    const marker = buffer[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    if (marker === 0xd9 || marker === 0xda) break;
    const length = buffer.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7), channels: buffer[i + 9] };
    }
    i += 2 + length;
  }
  return null;
}

type PngInfo = { width: number; height: number; channels: number; colorType: number; idat: Buffer[]; palette: Buffer | null };

function readPng(buffer: Buffer): PngInfo | null {
  if (buffer.length < 33 || buffer.readUInt32BE(0) !== 0x89504e47) return null;
  let offset = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
  let palette: Buffer | null = null;
  const idat: Buffer[] = [];
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("latin1", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") { width = data.readUInt32BE(0); height = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; interlace = data[12]; }
    else if (type === "PLTE") palette = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    offset += 12 + length;
  }
  if (!width || !height || bitDepth !== 8 || interlace !== 0 || idat.length === 0) return null;
  if (![0, 2, 3, 4, 6].includes(colorType)) return null;
  const channels = colorType === 0 ? 1 : colorType === 2 ? 3 : colorType === 3 ? 1 : colorType === 4 ? 2 : 4;
  return { width, height, channels, colorType, idat, palette };
}

function unfilterLine(filter: number, line: Buffer, prev: Buffer, channels: number, stride: number) {
  for (let x = 0; x < stride; x++) {
    const a = x >= channels ? line[x - channels] : 0;
    const b = prev[x] ?? 0;
    const c = x >= channels ? prev[x - channels] ?? 0 : 0;
    let value = line[x];
    if (filter === 1) value += a;
    else if (filter === 2) value += b;
    else if (filter === 3) value += (a + b) >> 1;
    else if (filter === 4) {
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    }
    line[x] = value & 0xff;
  }
}

function pngToRgb(buffer: Buffer): { width: number; height: number; rgb: Buffer } | null {
  const info = readPng(buffer);
  if (!info) return null;
  const { width, height, channels, colorType, palette } = info;
  let raw: Buffer;
  try { raw = zlib.inflateSync(Buffer.concat(info.idat)); } catch { return null; }
  const stride = width * channels;
  if (raw.length < (stride + 1) * height) return null;
  const out = Buffer.alloc(width * height * 3);
  let prev = Buffer.alloc(stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = Buffer.from(raw.subarray(pos, pos + stride));
    pos += stride;
    unfilterLine(filter, line, prev, channels, stride);
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 3;
      let r: number, g: number, b: number;
      if (colorType === 3 && palette) {
        const idx = line[x] * 3;
        r = palette[idx] ?? 255; g = palette[idx + 1] ?? 255; b = palette[idx + 2] ?? 255;
      } else if (channels >= 3) {
        r = line[x * channels]; g = line[x * channels + 1]; b = line[x * channels + 2];
      } else {
        r = g = b = line[x * channels];
      }
      if (channels === 4 || channels === 2) {
        const alpha = line[x * channels + channels - 1] / 255;
        r = Math.round(r * alpha + 255 * (1 - alpha));
        g = Math.round(g * alpha + 255 * (1 - alpha));
        b = Math.round(b * alpha + 255 * (1 - alpha));
      }
      out[o] = r; out[o + 1] = g; out[o + 2] = b;
    }
    prev = line;
  }
  return { width, height, rgb: out };
}

function decodeImage(input: PdfImageInput): DecodedImage | null {
  const jpeg = jpegSize(input.data);
  if (jpeg && (jpeg.channels === 1 || jpeg.channels === 3)) {
    return {
      width: jpeg.width, height: jpeg.height, payload: input.data,
      filter: "DCTDecode",
      colorSpace: jpeg.channels === 1 ? "DeviceGray" : "DeviceRGB",
      caption: input.caption,
    };
  }
  const png = pngToRgb(input.data);
  if (png) {
    return {
      width: png.width, height: png.height, payload: zlib.deflateSync(png.rgb),
      filter: "FlateDecode", colorSpace: "DeviceRGB", caption: input.caption,
    };
  }
  return null;
}

type Page = { ops: string[]; images: number[] };

const HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const HELV_B = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];

export function textWidth(text: string, size: number, bold = false) {
  const table = bold ? HELV_B : HELV;
  let total = 0;
  for (const char of toWinAnsi(text)) {
    const code = char.codePointAt(0) ?? 32;
    const width = code >= 32 && code <= 126 ? table[code - 32] : code >= 192 ? 556 : 278;
    total += width;
  }
  return (total / 1000) * size;
}


function wrapText(text: string, size: number, width: number, bold = false): string[] {
  const out: string[] = [];
  for (const paragraph of toWinAnsi(text).split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (textWidth(candidate, size, bold) <= width) { line = candidate; continue; }
      if (line) { out.push(line); line = ""; }
      let rest = word;
      while (textWidth(rest, size, bold) > width && rest.length > 1) {
        let cut = rest.length;
        while (cut > 1 && textWidth(rest.slice(0, cut), size, bold) > width) cut -= 1;
        out.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    out.push(line);
  }
  return out;
}


class PdfDoc {
  pages: Page[] = [];
  images: DecodedImage[] = [];
  y = PAGE_H - MARGIN;
  private page: Page | null = null;

  private newPage() {
    this.page = { ops: [], images: [] };
    this.pages.push(this.page);
    this.y = PAGE_H - MARGIN;
  }

  private ensure(space: number) {
    if (!this.page || this.y - space < MARGIN + 44) this.newPage();
  }

  private draw(text: string, size: number, bold: boolean, color = "0.12 0.16 0.24") {
    this.drawAt(text, MARGIN, this.y, size, bold, color);
  }

  private drawAt(text: string, x: number, y: number, size: number, bold: boolean, color = "0.12 0.16 0.24") {
    const font = bold ? "F2" : "F1";
    this.page!.ops.push(`BT ${color} rg /${font} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escapePdfText(text)}) Tj ET`);
  }

  private fill(x: number, y: number, w: number, h: number, color: string) {
    this.page!.ops.push(`${color} rg ${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  }

  private rule(x1: number, y: number, x2: number, color: string, width = 0.8) {
    this.page!.ops.push(`${color} RG ${width} w ${x1.toFixed(2)} ${y.toFixed(2)} m ${x2.toFixed(2)} ${y.toFixed(2)} l S`);
  }

  banner(title: string, subtitle: string, logo: DecodedImage | null) {
    this.newPage();
    if (logo) {
      const scale = Math.min(150 / logo.width, 56 / logo.height);
      const w = logo.width * scale;
      const h = logo.height * scale;
      this.placeImage(logo, MARGIN, PAGE_H - MARGIN - h + 10, w, h);
    }
    const titleSize = 18;
    this.drawAt(title, PAGE_W - MARGIN - textWidth(title, titleSize, true), PAGE_H - MARGIN - 16, titleSize, true, "0.03 0.08 0.16");
    this.drawAt(subtitle, PAGE_W - MARGIN - textWidth(subtitle, 9), PAGE_H - MARGIN - 34, 9, false, "0.42 0.50 0.60");
    this.fill(MARGIN, PAGE_H - MARGIN - 72, CONTENT_W, 2.5, "0.03 0.43 1");
    this.y = PAGE_H - MARGIN - 92;
  }

  sectionTitle(label: string) {
    this.ensure(44);
    this.y -= 24;
    this.fill(MARGIN, this.y - 2, 3, 12, "0.00 0.78 1");
    this.drawAt(label.toUpperCase(), MARGIN + 9, this.y, 10.5, true, "0.03 0.10 0.20");
    this.y -= 10;
  }

  metaGrid(pairs: Array<[string, string]>) {
    const colW = CONTENT_W / 2;
    for (let i = 0; i < pairs.length; i += 2) {
      const row = pairs.slice(i, i + 2);
      const heights = row.map(([, value]) => 12 + wrapText(value, 10, colW - 16).length * 12.5);
      const rowH = Math.max(...heights, 30);
      this.ensure(rowH);
      this.y -= rowH;
      row.forEach(([label, value], col) => {
        const x = MARGIN + col * colW;
        this.drawAt(label.toUpperCase(), x, this.y + rowH - 11, 7.5, true, "0.48 0.56 0.66");
        let lineY = this.y + rowH - 23;
        for (const line of wrapText(value, 10, colW - 16)) {
          this.drawAt(line, x, lineY, 10, false, "0.10 0.16 0.26");
          lineY -= 12.5;
        }
      });
      this.rule(MARGIN, this.y + 2, PAGE_W - MARGIN, "0.90 0.93 0.96", 0.5);
    }
    this.y -= 8;
  }

  table(headers: string[], widths: number[], rows: string[][], fontSize = 8.5) {
    const padding = 6;
    const lineHeight = fontSize * 1.3;
    const rowHeight = (cells: string[]) =>
      Math.max(...cells.map((cell, i) => wrapText(cell, fontSize, widths[i] - padding * 2).length)) * lineHeight + 8;
    const drawHeader = () => {
      this.ensure(34);
      this.y -= 20;
      this.fill(MARGIN, this.y, CONTENT_W, 20, "0.03 0.10 0.20");
      let x = MARGIN;
      headers.forEach((header, index) => {
        this.drawAt(header.toUpperCase(), x + padding, this.y + 6.5, 7.5, true, "1 1 1");
        x += widths[index];
      });
      this.y -= 2;
    };
    drawHeader();
    rows.forEach((cells, rowIndex) => {
      const height = rowHeight(cells);
      if (this.y - height < MARGIN + 44) drawHeader();
      this.y -= height;
      if (rowIndex % 2 === 1) this.fill(MARGIN, this.y, CONTENT_W, height, "0.96 0.97 0.99");
      let x = MARGIN;
      cells.forEach((cell, index) => {
        let lineY = this.y + height - 12;
        for (const line of wrapText(cell, fontSize, widths[index] - padding * 2)) {
          this.drawAt(line, x + padding, lineY, fontSize, false, "0.10 0.16 0.26");
          lineY -= lineHeight;
        }
        x += widths[index];
      });
      this.rule(MARGIN, this.y, PAGE_W - MARGIN, "0.90 0.93 0.96", 0.5);
    });
    this.y -= 8;
  }

  heading(text: string) {
    this.ensure(40);
    this.y -= 20;
    this.draw(text, 12, true, "0.03 0.43 1");
    this.y -= 6;
  }

  paragraph(text: string, size = 10, bold = false, color = "0.16 0.22 0.32") {
    const lines = wrapText(text, size, CONTENT_W, bold);
    const lineHeight = size * 1.45;
    for (const line of lines) {
      this.ensure(lineHeight + 4);
      this.y -= lineHeight;
      this.draw(line, size, bold, color);
    }
    this.y -= 4;
  }

  keyValue(label: string, value: string) {
    const lineHeight = 15;
    this.ensure(lineHeight + 4);
    this.y -= lineHeight;
    this.draw(`${label} ${value}`, 10, false, "0.20 0.30 0.42");
  }

  private placeImage(decoded: DecodedImage, x: number, y: number, w: number, h: number) {
    this.page!.ops.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im${this.images.length} Do Q`);
    this.page!.images.push(this.images.length);
    this.images.push(decoded);
  }

  photoGrid(images: PdfImageInput[]) {
    const gap = 14;
    const cellW = (CONTENT_W - gap) / 2;
    const cellH = 168;
    for (let i = 0; i < images.length; i += 2) {
      this.ensure(cellH + 36);
      this.y -= cellH + 10;
      images.slice(i, i + 2).forEach((img, col) => {
        const decoded = decodeImage(img);
        if (!decoded) return;
        const scale = Math.min(cellW / decoded.width, cellH / decoded.height);
        const w = decoded.width * scale;
        const h = decoded.height * scale;
        const x = MARGIN + col * (cellW + gap);
        this.placeImage(decoded, x, this.y + (cellH - h), w, h);
        this.drawAt(img.caption ?? "Photo", x, this.y - 12, 8, false, "0.40 0.48 0.58");
      });
      this.y -= 14;
    }
  }

  image(img: PdfImageInput) {
    const decoded = decodeImage(img);
    if (!decoded) {
      this.paragraph(`${img.caption ?? "Photo"} : format non supporte`, 9);
      return;
    }
    const scale = Math.min(CONTENT_W / decoded.width, 250 / decoded.height);
    const w = decoded.width * scale;
    const h = decoded.height * scale;
    this.ensure(h + 32);
    this.y -= h + 6;
    const x = MARGIN + (CONTENT_W - w) / 2;
    this.placeImage(decoded, x, this.y, w, h);
    if (decoded.caption) {
      this.y -= 14;
      this.draw(decoded.caption, 9, false, "0.35 0.45 0.55");
    }
    this.y -= 14;
  }

  build(): Buffer {
    if (!this.pages.length) this.newPage();
    const total = this.pages.length;
    const footerY = MARGIN - 20;
    const brand = "NaviGarde IA  -  Securite maritime  -  Benin";
    this.pages.forEach((page, index) => {
      const pageLabel = `Page ${index + 1} / ${total}`;
      page.ops.push(`BT 0.42 0.50 0.60 rg /F1 7.5 Tf 1 0 0 1 ${MARGIN} ${footerY.toFixed(2)} Tm (${escapePdfText(brand)}) Tj ET`);
      page.ops.push(`BT 0.42 0.50 0.60 rg /F1 7.5 Tf 1 0 0 1 ${(PAGE_W - MARGIN - textWidth(pageLabel, 7.5)).toFixed(2)} ${footerY.toFixed(2)} Tm (${escapePdfText(pageLabel)}) Tj ET`);
      page.ops.push(`${MARGIN} ${(MARGIN - 30).toFixed(2)} m ${(PAGE_W - MARGIN).toFixed(2)} ${(MARGIN - 30).toFixed(2)} l 0.85 0.89 0.94 RG 0.6 w S`);
    });
    const objects: Array<{ id: number; head: string; stream?: Buffer }> = [];
    const imageBase = 5 + total * 2;
    objects.push({ id: 1, head: "<< /Type /Catalog /Pages 2 0 R >>" });
    objects.push({ id: 2, head: `<< /Type /Pages /Kids [${this.pages.map((_, i) => `${5 + i * 2} 0 R`).join(" ")}] /Count ${total} >>` });
    objects.push({ id: 3, head: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>" });
    objects.push({ id: 4, head: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>" });
    this.pages.forEach((page, index) => {
      const xobjects = page.images.map((imgIndex) => `/Im${imgIndex} ${imageBase + imgIndex} 0 R`).join(" ");
      const resources = `<< /Font << /F1 3 0 R /F2 4 0 R >>${xobjects ? ` /XObject << ${xobjects} >>` : ""} >>`;
      objects.push({ id: 5 + index * 2, head: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W.toFixed(2)} ${PAGE_H.toFixed(2)}] /Resources ${resources} /Contents ${6 + index * 2} 0 R >>` });
      objects.push({ id: 6 + index * 2, head: "<< >>", stream: Buffer.from(page.ops.join("\n"), "latin1") });
    });
    this.images.forEach((img, index) => {
      objects.push({
        id: imageBase + index,
        head: `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /${img.colorSpace} /BitsPerComponent 8 /Filter /${img.filter} >>`,
        stream: img.payload,
      });
    });
    objects.sort((a, b) => a.id - b.id);
    const chunks: Buffer[] = [];
    let length = 0;
    const push = (value: Buffer | string) => {
      const buf = typeof value === "string" ? Buffer.from(value, "latin1") : value;
      chunks.push(buf);
      length += buf.length;
    };
    const offsets = new Map<number, number>();
    push("%PDF-1.4\n");
    for (const obj of objects) {
      offsets.set(obj.id, length);
      if (obj.stream) {
        const head = obj.head === "<< >>" ? `<< /Length ${obj.stream.length} >>` : obj.head.replace(/>>$/, `/Length ${obj.stream.length} >>`);
        push(`${obj.id} 0 obj\n${head}\nstream\n`);
        push(obj.stream);
        push("\nendstream\nendobj\n");
      } else {
        push(`${obj.id} 0 obj\n${obj.head}\nendobj\n`);
      }
    }
    const xref = length;
    const maxId = Math.max(...objects.map((obj) => obj.id));
    push(`xref\n0 ${maxId + 1}\n0000000000 65535 f \n`);
    for (let id = 1; id <= maxId; id++) push(`${String(offsets.get(id) ?? 0).padStart(10, "0")} 00000 n \n`);
    push(`trailer\n<< /Size ${maxId + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return Buffer.concat(chunks, length);
  }
}

export type PdfSection = { heading?: string; lines?: string[] };

export type InspectionPdfModel = {
  title: string;
  subtitle?: string;
  logo?: PdfImageInput | null;
  meta?: Array<[string, string]>;
  sections?: PdfSection[];
  tables?: Array<{ heading?: string; headers: string[]; widths: number[]; rows: string[][] }>;
  images?: Array<PdfImageInput | null>;
  footerNote?: string;
};

export function buildInspectionPdf(model: InspectionPdfModel): Buffer {
  const doc = new PdfDoc();
  const logo = model.logo ? decodeImage(model.logo) : null;
  doc.banner(model.title, model.subtitle ?? "", logo);
  if (model.meta?.length) doc.metaGrid(model.meta);
  for (const section of model.sections ?? []) {
    if (section.heading) doc.sectionTitle(section.heading);
    for (const line of section.lines ?? []) doc.paragraph(line);
  }
  const images = (model.images ?? []).filter((img): img is PdfImageInput => Boolean(img));
  for (const table of model.tables ?? []) {
    if (table.heading) doc.sectionTitle(table.heading);
    doc.table(table.headers, table.widths, table.rows);
  }
  if (images.length) {
    doc.sectionTitle(`Photos (${images.length})`);
    doc.photoGrid(images.map((img, index) => ({ ...img, caption: img.caption ?? `Photo ${index + 1}` })));
  }
  if (model.footerNote) {
    doc.sectionTitle("Validation humaine");
    doc.paragraph(model.footerNote, 9, false, "0.30 0.40 0.50");
  }
  return doc.build();
}












