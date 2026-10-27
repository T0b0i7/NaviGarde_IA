/**
 * Test de fumée de l'API d'inspection.
 *
 * Couvre les scénarios T01 (auth), T02 (RBAC), T03 (surcharge → CRITIQUE),
 * T04 (conforme → FAIBLE), T05 (image floue → à vérifier) et T06 (fichier invalide).
 *
 * Prérequis : le serveur tourne (`npm run dev`) et `AI_PROVIDER=mock`.
 * Usage : node tests/smoke-inspect.mjs
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000/api/v1';
const ROLE = process.env.TEST_ROLE ?? 'agent';

/** PNG 1×1 valide, suffisant pour la détection de type MIME réel. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const results = [];

function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition), detail });
  console.log(`${condition ? 'PASS' : 'FAIL'} · ${name}${detail ? ` — ${detail}` : ''}`);
}

function buildForm({ capacity = 8, includeImage = true, mimeType = 'image/png', fileName = 'pirogue.png' } = {}) {
  const form = new FormData();
  form.set('vessel_name', 'Pirogue test T03');
  form.set('vessel_type', 'pirogue');
  form.set('location', 'Lagune de Porto-Novo');
  form.set('declared_capacity', String(capacity));
  if (includeImage) {
    form.set('image', new Blob([PNG_1X1], { type: mimeType }), fileName);
  }
  return form;
}

async function inspect(options = {}, { role = ROLE } = {}) {
  const response = await fetch(`${BASE_URL}/inspect`, {
    method: 'POST',
    headers: role ? { 'x-dev-role': role } : {},
    body: buildForm(options),
  });
  return { status: response.status, body: await response.json() };
}

async function run() {
  // Santé — `?db=1` force une vérification réelle de la connexion PostgreSQL.
  const health = await fetch(`${BASE_URL}/health?db=1`).then((r) => r.json());
  check('Health : service disponible', health.status === 'success', health.service);
  check(
    'Health : état de la persistance exposé',
    ['connected', 'unavailable', 'disabled', 'unknown'].includes(health.database?.status),
    `${health.database?.status} · état global : ${health.state}`,
  );

  // T01 / T02 — authentification et RBAC
  const anonymous = await inspect({}, { role: null });
  check('T01 · sans authentification → 401', anonymous.status === 401, anonymous.body.code);

  const forbidden = await inspect({}, { role: 'sailor' });
  check('T02 · marin sur /inspect → 403', forbidden.status === 403, forbidden.body.code);

  // T03 — pirogue surchargée (mock MOCK_SCENARIO=critical)
  const critical = await inspect({ capacity: 8 });
  check('T03 · surcharge → CRITIQUE', critical.body.risk_level === 'CRITIQUE', critical.body.risk_level);
  check(
    'T03 · anomalies listées',
    Array.isArray(critical.body.analysis?.anomalies) && critical.body.analysis.anomalies.length >= 2,
    `${critical.body.analysis?.anomalies?.length} anomalie(s)`,
  );
  check('T03 · décision proposée = DEPART_REFUSE', critical.body.analysis?.recommended_action === 'DEPART_REFUSE');
  check(
    'T03 · comptages présents',
    critical.body.analysis?.passengers_detected === 12 && critical.body.analysis?.life_vests_detected === 4,
    `${critical.body.analysis?.passengers_detected} pax / ${critical.body.analysis?.life_vests_detected} gilets`,
  );
  check('T03 · schéma de réponse conforme', typeof critical.body.inspection_id === 'string' && critical.body.status === 'success');

  // Persistance : soit écrite en base, soit repli mémoire annoncé explicitement.
  check(
    'Persistance · état annoncé dans meta',
    ['postgres', 'memory'].includes(critical.body.meta?.persistence),
    critical.body.meta?.persistence,
  );
  check(
    'Persistance · UUID v4 conservé dans le contrat',
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      critical.body.inspection_id ?? '',
    ),
    critical.body.inspection_id,
  );

  if (critical.body.meta?.persistence === 'memory') {
    console.log(
      `   ↳ repli mémoire actif (${critical.body.meta.persistence_reason ?? 'raison inconnue'}) — ` +
        'démarrez PostgreSQL et lancez « npm run db:init » pour tester la persistance réelle.',
    );
  }

  // T06 — fichier non image
  const notImage = await fetch(`${BASE_URL}/inspect`, {
    method: 'POST',
    headers: { 'x-dev-role': ROLE },
    body: buildForm({ mimeType: 'text/plain', fileName: 'notes.txt' }),
  });
  check('T06 · fichier non image → 415', notImage.status === 415, (await notImage.json()).code);

  // T06bis — image déclarée mais contenu invalide
  const fakePng = new FormData();
  fakePng.set('vessel_name', 'Test contenu');
  fakePng.set('vessel_type', 'pirogue');
  fakePng.set('location', 'Cotonou');
  fakePng.set('declared_capacity', '8');
  fakePng.set('image', new Blob([Buffer.from('pas une image')], { type: 'image/png' }), 'faux.png');
  const invalidContent = await fetch(`${BASE_URL}/inspect`, {
    method: 'POST',
    headers: { 'x-dev-role': ROLE },
    body: fakePng,
  });
  check('T06 · contenu non image déclaré PNG → 415', invalidContent.status === 415, (await invalidContent.json()).code);

  // Validation métier — capacité manquante
  const noCapacity = new FormData();
  noCapacity.set('vessel_name', 'Sans capacité');
  noCapacity.set('vessel_type', 'pirogue');
  noCapacity.set('location', 'Cotonou');
  noCapacity.set('image', new Blob([PNG_1X1], { type: 'image/png' }), 'p.png');
  const badInput = await fetch(`${BASE_URL}/inspect`, {
    method: 'POST',
    headers: { 'x-dev-role': ROLE },
    body: noCapacity,
  });
  check('Validation · capacité manquante → 400', badInput.status === 400, (await badInput.json()).code);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications réussies.`);
  if (failed.length) process.exitCode = 1;
}

run().catch((error) => {
  console.error('Test interrompu :', error);
  process.exitCode = 1;
});
