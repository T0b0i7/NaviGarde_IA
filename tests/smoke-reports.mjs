/**
 * Test de fumée du module Rapport (génération + immutabilité).
 *
 * Prérequis : `npm run dev` et `AI_PROVIDER=mock`.
 * Usage : node tests/smoke-reports.mjs
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
  console.log(`${condition ? 'PASS' : 'FAIL'} · ${name}${detail ? ` — ${detail}` : ''}`);
}

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

async function api(method, path, { role, body, form } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(role ? { 'x-dev-role': role } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    ...(form ? { body: form } : {}),
  });
  return { status: response.status, body: await response.json() };
}

/** Crée une inspection réelle via l'API, pour obtenir un UUID valide. */
async function createInspection() {
  const form = new FormData();
  form.set('vessel_name', 'Pirogue rapport T10');
  form.set('vessel_type', 'pirogue');
  form.set('location', 'Lac Nokoué');
  form.set('declared_capacity', '8');
  form.set('image', new Blob([PNG_1X1], { type: 'image/png' }), 'pirogue.png');
  return api('POST', '/inspect', { role: 'agent', form });
}

async function run() {
  const inspection = await createInspection();
  const inspectionId = inspection.body.inspection_id;
  check('Inspection support créée', Boolean(inspectionId), inspectionId);

  const generated = await api('POST', '/generate-report', {
    role: 'agent',
    body: { inspection_id: inspectionId, type: 'infraction' },
  });
  const reportId = generated.body.report_id;
  const content = generated.body.content ?? '';
  const hash = generated.body.cryptographic_hash ?? '';

  check('Génération acceptée', generated.status === 201, `HTTP ${generated.status}`);
  check('Synthèse administrative présente', content.includes('RÉPUBLIQUE DU BÉNIN') && content.includes('CONSTATS'));
  check('Mention IA obligatoire', content.includes('Rédigé avec assistance IA, vérifié par un agent.'));
  check('Hash SHA-256 (64 hex)', /^[0-9a-f]{64}$/.test(hash), hash.slice(0, 16));
  check('Hash = SHA-256 du texte', sha256(content) === hash);
  check('Statut initial brouillon', generated.body.report_status === 'brouillon', generated.body.report_status);
  const read = await api('GET', `/reports/${reportId}`, { role: 'agent' });
  check('Relecture', read.status === 200 && read.body.report?.content === content);
  check('Intégrité vérifiée', read.body.integrity === 'ok', read.body.integrity);
  check('Hash relu identique', read.body.report?.cryptographic_hash === hash);

  const edited = "RAPPORT D'INSPECTION MARITIME\n\nContenu corrigé par l'agent avant soumission.";
  const patch = await api('PATCH', `/reports/${reportId}`, { role: 'agent', body: { content: edited } });
  check('Édition du brouillon autorisée', patch.status === 200, `HTTP ${patch.status}`);
  check('Hash recalculé après édition', patch.body.cryptographic_hash === sha256(edited));
  const agentValidate = await api('POST', `/reports/${reportId}/validate`, { role: 'agent' });
  check('Validation refusée à l\'agent → 403', agentValidate.status === 403, agentValidate.body.code);

  const validated = await api('POST', `/reports/${reportId}/validate`, { role: 'supervisor' });
  check('Validation superviseur', validated.status === 200 && validated.body.report?.status === 'valide');
  check('Signature horodatée', Boolean(validated.body.report?.validated_at));
  const versioned = await api('PATCH', `/reports/${reportId}`, {
    role: 'agent',
    body: { content: 'Version 2 du rapport, après validation du superviseur.' },
  });
  check('Rapport validé cloné en v2 → 201', versioned.status === 201 && versioned.body.version === 2, `HTTP ${versioned.status} · v${versioned.body.version}`);
  check('Nouveau brouillon rattaché au parent', versioned.body.report_status === 'brouillon' && versioned.body.previous_report_id === reportId);

  const afterLock = await api('GET', `/reports/${reportId}`, { role: 'agent' });
  check('Version 1 inchangée', afterLock.body.report?.content === edited);
  check('Intégrité toujours valide', afterLock.body.integrity === 'ok');

  const noInspection = await api('POST', '/generate-report', { role: 'agent', body: { inspection_id: inspectionId } });
  check('Rapport reproductible depuis la même inspection', noInspection.status === 201);

  const missing = await api('POST', '/generate-report', { role: 'agent', body: {} });
  check('inspection_id requis → 400', missing.status === 400, missing.body.code);

  const unknown = await api('POST', '/generate-report', {
    role: 'agent',
    body: { inspection_id: '00000000-0000-4000-8000-000000000000' },
  });
  check('Inspection inconnue → 404', unknown.status === 404, unknown.body.code);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications réussies.`);
  if (failed.length) process.exitCode = 1;
}

run().catch((error) => {
  console.error('Test interrompu :', error);
  process.exitCode = 1;
});
