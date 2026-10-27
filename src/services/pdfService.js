/**
 * Export PDF réglementaire d'un rapport (EF-34).
 * En-tête officielle, métadonnées, corps du rapport, QR de vérification et
 * empreinte SHA-256 en pied de page.
 */

import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

const BASE_URL = (process.env.PUBLIC_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

/** URL publique de vérification encodée dans le QR code. */
export function verificationUrl(reportId) {
  return `${BASE_URL}/api/v1/reports/${reportId}`;
}

/**
 * Construit le PDF en mémoire.
 * @param {object} report rapport relu depuis la base
 * @returns {Promise<Buffer>}
 */
export async function buildReportPdf(report) {
  const qr = await QRCode.toBuffer(verificationUrl(report.id), { margin: 1, width: 240 });
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    bufferPages: true,
    info: {
      Title: `Rapport NaviGarde IA — ${report.id}`,
      Author: 'NaviGarde IA',
      Subject: `Rapport ${report.report_type} v${report.version}`,
      Keywords: report.cryptographic_hash,
    },
  });

  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  drawHeader(doc, report);
  drawMetadata(doc, report);
  drawBody(doc, report.generated_text);

  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    drawFooter(doc, report, qr, index + 1, range.count);
  }

  doc.end();
  return done;
}

function drawHeader(doc, report) {
  doc.font('Helvetica-Bold').fontSize(11).text('RÉPUBLIQUE DU BÉNIN', { align: 'center' });
  doc.font('Helvetica').fontSize(9).text('NaviGarde IA — Sécurité maritime et portuaire', {
    align: 'center',
  });
  doc.moveDown(0.4).moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#1f4e79').stroke();
  doc.moveDown(0.8);
  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor('#1f4e79')
    .text(`RAPPORT OFFICIEL — ${String(report.report_type ?? '').toUpperCase()}`, {
      align: 'center',
    });
  doc.fillColor('#000000').moveDown(0.8);
}

function drawMetadata(doc, report) {
  const rows = [
    ['Référence', report.id],
    ['Version', `v${report.version}`],
    ['Statut', report.status === 'valide' ? 'VALIDÉ ET VERROUILLÉ' : 'BROUILLON'],
    ['Inspection', report.inspection_id],
    ['Alerte liée', report.alert_id ?? 'aucune'],
    ['Date', String(report.created_at ?? new Date().toISOString())],
  ];

  for (const [label, value] of rows) {
    doc.font('Helvetica-Bold').fontSize(9).text(`${label} : `, { continued: true });
    doc.font('Helvetica').text(String(value));
  }
  doc.moveDown(0.8);
}

/** Retire l'en-tête déjà imprimé par le gabarit pour éviter le doublon visuel. */
function bodyOf(text) {
  const lines = String(text ?? '').split('\n');
  let start = 0;
  while (
    start < lines.length &&
    (lines[start].trim() === '' ||
      /^RÉPUBLIQUE DU BÉNIN/i.test(lines[start]) ||
      /^RAPPORT D/i.test(lines[start]))
  ) {
    start += 1;
  }
  return lines.slice(start).join('\n');
}

function drawBody(doc, text) {
  doc.font('Helvetica').fontSize(10).fillColor('#111111');
  doc.text(bodyOf(text), { align: 'justify', lineGap: 2 });
}

function drawFooter(doc, report, qr, page, total) {
  const bottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  const top = doc.page.height - 165;
  doc.moveTo(50, top).lineTo(545, top).strokeColor('#1f4e79').lineWidth(1).stroke();

  doc.image(qr, 50, top + 10, { width: 74 });
  doc
    .font('Helvetica')
    .fontSize(6)
    .fillColor('#444444')
    .text('Vérification', 50, top + 88, { width: 74, align: 'center' });

  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor('#1f4e79')
    .text('SCEAU DE SOUVERAINETÉ NUMÉRIQUE', 136, top + 10, { width: 410 });

  doc
    .font('Courier')
    .fontSize(7.5)
    .fillColor('#111111')
    .text(report.cryptographic_hash ?? '', 136, top + 26, { width: 410 });

  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor('#444444')
    .text(
      `SHA-256 · v${report.version} · page ${page}/${total} · Rédigé avec assistance IA, vérifié par un agent.`,
      136,
      top + 62,
      { width: 410 },
    );

  doc.page.margins.bottom = bottom;
}

