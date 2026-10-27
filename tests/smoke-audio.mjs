/**
 * Test de fumée du copilote vocal (POST /api/v1/voice-alert).
 *
 * Prérequis : `npm run dev` et `AI_PROVIDER=mock`.
 * Usage : node tests/smoke-audio.mjs
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000/api/v1';

const results = [];

function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition) });
  console.log(`${condition ? 'PASS' : 'FAIL'} · ${name}${detail ? ` — ${detail}` : ''}`);
}

/** En-tête WAV minimal (44 octets), suffisant pour la détection du type réel. */
function fakeWav() {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(8000, 24);
  header.writeUInt32LE(8000, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(0, 40);
  return header;
}

function buildForm({ includeAudio = true, mimeType = 'audio/wav', body, fileName = 'alerte.wav' } = {}) {
  const form = new FormData();
  if (includeAudio) {
    form.set('audio', new Blob([body ?? fakeWav()], { type: mimeType }), fileName);
  }
  return form;
}

async function post(options) {
  const response = await fetch(`${BASE_URL}/voice-alert`, { method: 'POST', body: buildForm(options) });
  return { status: response.status, body: await response.json() };
}

async function run() {
  // 1. Alerte nominale : WAV factice + scénario mock « panne moteur ».
  const ok = await post();
  const analysis = ok.body.analysis ?? {};
  const urgency = analysis.urgency;

  check('Téléversement accepté', ok.status === 201, `HTTP ${ok.status}`);
  check('Identifiant UUID v4', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ok.body.alert_id ?? ''), ok.body.alert_id);
  check('Transcription non vide', typeof ok.body.transcript === 'string' && ok.body.transcript.length > 10);
  check('Langue identifiée', typeof ok.body.language === 'string' && ok.body.language.length >= 2, ok.body.language);
  check(
    'urgency dans l\'échelle autorisée',
    ['FAIBLE', 'MOYEN', 'ELEVE', 'CRITIQUE'].includes(urgency),
    urgency,
  );
  check('Résumé non vide', typeof analysis.summary === 'string' && analysis.summary.length > 10, analysis.summary);
  check(
    'Résumé de 2 phrases maximum',
    (analysis.summary.match(/[.!?]/g) ?? []).length <= 2,
    `${(analysis.summary.match(/[.!?]/g) ?? []).length} phrase(s)`,
  );
  check('Persistance annoncée', ['postgres', 'memory'].includes(ok.body.meta?.persistence), ok.body.meta?.persistence);
  check('Position nulle si non fournie', ok.body.position === null);
  check('Aucune coordonnée inventée', !JSON.stringify(ok.body).includes('latitude":') || ok.body.position === null);

  // 2. Sans fichier
  const missing = await post({ includeAudio: false });
  check('Sans audio → 400', missing.status === 400 && missing.body.code === 'MISSING_AUDIO', missing.body.code);

  // 3. Type déclaré non audio
  const wrongType = await post({ mimeType: 'text/plain', fileName: 'notes.txt' });
  check('Type non audio → 415', wrongType.status === 415, wrongType.body.code);

  // 4. Type déclaré audio mais contenu invalide
  const garbage = await post({ body: Buffer.from('pas un fichier audio lisible') });
  check('Contenu invalide → 415', garbage.status === 415 && garbage.body.code === 'INVALID_AUDIO_CONTENT', garbage.body.code);

  // 5. Position hors bornes
  const form = buildForm();
  form.set('latitude', '200');
  form.set('longitude', '2.4');
  const badPosition = await fetch(`${BASE_URL}/voice-alert`, { method: 'POST', body: form });
  check('Position hors bornes → 400', badPosition.status === 400, (await badPosition.json()).code);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications réussies.`);
  if (failed.length) process.exitCode = 1;
}

run().catch((error) => {
  console.error('Test interrompu :', error);
  process.exitCode = 1;
});
