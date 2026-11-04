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

function wrapText(text: string, size: number, width: number, bold = false): string[] {
  const charW = size * (bold ? 0.54 : 0.5);
  const max = Math.max(8, Math.floor(width / charW));
  const out: string[] = [];
  for (const paragraph of toWinAnsi(text).split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      if (!line) { line = word; continue; }
      if (line.length + 1 + word.length <= max) line += " " + word;
      else { out.push(line); line = word; }
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
    const font = bold ? "F2" : "F1";
    this.page!.ops.push(`BT ${color} rg /${font} ${size} Tf 1 0 0 1 ${MARGIN.toFixed(2)} ${this.y.toFixed(2)} Tm (${escapePdfText(text)}) Tj ET`);
  }

  title(text: string) {
    this.ensure(60);
    this.y -= 26;
    this.draw(text, 19, true, "0.03 0.08 0.16");
    this.y -= 10;
    this.page!.ops.push(`${MARGIN} ${this.y.toFixed(2)} m ${(PAGE_W - MARGIN).toFixed(2)} ${this.y.toFixed(2)} l S`);
    this.y -= 16;
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
    this.page!.ops.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${this.y.toFixed(2)} cm /Im${this.images.length} Do Q`);
    this.page!.images.push(this.images.length);
    this.images.push(decoded);
    if (decoded.caption) {
      this.y -= 14;
      this.draw(decoded.caption, 9, false, "0.35 0.45 0.55");
    }
    this.y -= 14;
  }

  build(): Buffer {
    if (!this.pages.length) this.newPage();
    const total = this.pages.length;
    this.pages.forEach((page, index) => {
      page.ops.push(`BT 0.45 0.55 0.65 rg /F1 8 Tf 1 0 0 1 ${MARGIN} ${(MARGIN - 20).toFixed(2)} Tm (NaviGarde IA - Page ${index + 1} / ${total}) Tj ET`);
      page.ops.push(`${MARGIN} ${(MARGIN - 32).toFixed(2)} m ${(PAGE_W - MARGIN).toFixed(2)} ${(MARGIN - 32).toFixed(2)} l 0.85 0.89 0.94 RG S`);
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
  meta?: Array<[string, string]>;
  sections?: PdfSection[];
  images?: Array<PdfImageInput | null>;
  footerNote?: string;
};

export function buildInspectionPdf(model: InspectionPdfModel): Buffer {
  const doc = new PdfDoc();
  doc.title(model.title);
  if (model.subtitle) doc.paragraph(model.subtitle, 10, false, "0.35 0.45 0.55");
  for (const [label, value] of model.meta ?? []) doc.keyValue(`${label} :`, value);
  for (const section of model.sections ?? []) {
    if (section.heading) doc.heading(section.heading);
    for (const line of section.lines ?? []) doc.paragraph(line);
  }
  const images = (model.images ?? []).filter((img): img is PdfImageInput => Boolean(img));
  if (images.length) {
    doc.heading(`PHOTOS (${images.length})`);
    images.forEach((img, index) => doc.image({ ...img, caption: img.caption ?? `Photo ${index + 1}` }));
  }
  if (model.footerNote) {
    doc.heading("VALIDATION HUMAINE");
    doc.paragraph(model.footerNote, 9, false, "0.30 0.40 0.50");
  }
  return doc.build();
}












