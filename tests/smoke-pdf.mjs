/**
 * Test de fumée PDF + versioning (EF-34 / EF-35).
 *
 * Prérequis : `npm run dev` et `AI_PROVIDER=mock`.
 * Usage : npm run test:pdf
 */

import { createHash } from 'node:crypto';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000/api/v1';
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const results = [];

function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition) });
  console.log(`${condition ? 'PASS' : 'FAIL'} — ${name}${detail ? ` — ${detail}` : ''}`);
}

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

async function api(method, path, { role, body, form } = {}) {
  const headers = {};
  if (role) headers['x-dev-role'] = role;
  if (body && !form) headers['content-type'] = 'application/json';

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    ...(body && !form ? { body: JSON.stringify(body) } : {}),
    ...(form ? { body: form } : {}),
  });

  const contentType = response.headers.get('content-type') ?? '';
  let payload = null;
  if (contentType.includes('application/json')) {
    payload = await response.json();
  } else if (contentType.includes('application/pdf')) {
    payload = await response.arrayBuffer();
  } else {
    try {
      payload = await response.text();
    } catch {
      payload = null;
    }
  }

  return { status: response.status, headers: response.headers, contentType, body: payload };
}

/** Crée une inspection réelle via l'API pour obtenir un UUID valide. */
async function createInspection() {
  const form = new FormData();
  form.set('vessel_name', 'Pirogue PDF T14');
  form.set('vessel_type', 'pirogue');
  form.set('location', 'Port de Cotonou');
  form.set('declared_capacity', '10');
  form.set('image', new Blob([PNG_1X1], { type: 'image/png' }), 'pirogue.png');
  return api('POST', '/inspect', { role: 'agent', form });
}

async function run() {
  const inspection = await createInspection();
  const inspectionId = inspection.body?.inspection_id;
  check('Inspection support créée', Boolean(inspectionId), inspectionId);

  const generated = await api('POST', '/generate-report', {
    role: 'agent',
    body: { inspection_id: inspectionId, type: 'infraction' },
  });
  const reportId = generated.body?.report_id;
  const content = generated.body?.content ?? '';
  const hash = generated.body?.cryptographic_hash ?? '';

  check('Génération acceptée', generated.status === 201, `HTTP ${generated.status}`);
  check('Synthèse administrative présente', content.includes('RÉPUBLIQUE DU BÉNIN') && content.includes('CONSTATS'));
  check('Mention IA obligatoire', content.includes('Rédigé avec assistance IA, vérifié par un agent.'));
  check('Hash SHA-256 (64 hex)', /^[0-9a-f]{64}$/.test(hash), hash.slice(0, 16));
  check('Hash = SHA-256 du texte', sha256(content) === hash);
  check('Statut initial brouillon', generated.body?.report_status === 'brouillon', generated.body?.report_status);

  // Téléchargement PDF
  const download = await api('GET', `/reports/${reportId}/download`, { role: 'agent' });
  check('Téléchargement PDF accessible', download.status === 200, `HTTP ${download.status}`);
  check("Content-Type 'application/pdf'", download.contentType.includes('application/pdf'), download.contentType);
  check('Corps PDF non vide', download.body instanceof ArrayBuffer && download.body.byteLength > 100, `${download.body?.byteLength ?? 0} bytes`);
  check("En-tête X-Report-SHA256 présent", Boolean(download.headers.get('x-report-sha256')), download.headers.get('x-report-sha256'));

  // Validation superviseur puis versioning
  const validated = await api('POST', `/reports/${reportId}/validate`, { role: 'supervisor' });
  check('Validation superviseur', validated.status === 200 && validated.body?.report?.status === 'valide');

  const versioned = await api('PATCH', `/reports/${reportId}`, {
    role: 'agent',
    body: { content: "RAPPORT D'INSPECTION MARITIME\n\nVersion 2 du rapport, après validation du superviseur.\n\nRédigé avec assistance IA, vérifié par un agent." },
  });
  check('Rapport validé cloné en v2 → 201', versioned.status === 201 && versioned.body?.version === 2, `HTTP ${versioned.status} v${versioned.body?.version}`);
  check('Nouveau brouillon rattaché au parent', versioned.body?.report_status === 'brouillon' && versioned.body?.previous_report_id === reportId);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications réussies.`);
  if (failed.length) process.exitCode = 1;
}

run().catch((error) => {
  console.error('Test interrompu :', error);
  process.exitCode = 1;
});
