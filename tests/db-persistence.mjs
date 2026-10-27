/**
 * Test d'intégration de la persistance PostgreSQL.
 *
 * Nécessite une base réelle :
 *   npm run db:init
 *   RUN_DB_TESTS=1 npm run test:db
 *
 * Sans `RUN_DB_TESTS=1`, le script se contente d'expliquer quoi faire et sort en 0,
 * pour ne jamais bloquer une CI sans service Postgres.
 */

process.env.RUN_DB_TESTS === '1' ||
  (console.log(
    'Test ignoré : définissez RUN_DB_TESTS=1 (après « npm run db:init ») pour lancer la persistance réelle.',
  ),
  process.exit(0));

const { closePool, getDbStatus, ping, query } = await import('../src/config/db.js');
const { findInspection, saveInspection } = await import('../src/repositories/inspectionRepository.js');

const results = [];

function check(name, condition, detail = '') {
  results.push({ name, ok: Boolean(condition) });
  console.log(`${condition ? 'PASS' : 'FAIL'} · ${name}${detail ? ` — ${detail}` : ''}`);
}

/** Résultat représentatif de `runInspection`, pour vérifier le mapping colonne. */
function sampleResult(id) {
  return {
    status: 'success',
    inspection_id: id,
    risk_level: 'CRITIQUE',
    confidence: 0.82,
    needs_review: false,
    analysis: {
      passengers_detected: 12,
      life_vests_detected: 4,
      declared_capacity: 8,
      anomalies: [
        'Surcharge détectée : 12 passagers pour 8 places déclarées',
        'Équipement de sauvetage insuffisant : 4 gilets pour 12 passagers',
      ],
      recommended_action: 'DEPART_REFUSE',
    },
    vessel: { name: 'Pirogue test DB', type: 'pirogue', location: 'Lagune de Porto-Novo' },
    meta: { inspection_status: 'analysee', ai_provider: 'mock' },
  };
}

try {
  const alive = await ping();
  check('Connexion PostgreSQL', alive, JSON.stringify(getDbStatus()));

  if (!alive) {
    console.error('\nBase injoignable : vérifiez PG* dans .env, puis « npm run db:init ».');
    process.exitCode = 1;
  } else {
    const { rows: tables } = await query(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN ('inspections', 'alerts', 'reports')`,
    );
    check('Tables présentes', tables.length === 3, tables.map((t) => t.table_name).join(', '));

    const id = crypto.randomUUID();
    const saved = await saveInspection(sampleResult(id));
    check('Écriture en base (et non en mémoire)', saved.persisted === 'postgres', saved.persisted);

    const row = await findInspection(id);
    check('Relecture par identifiant', row?.id === id);
    check('Colonnes aplaties', row?.vessel_name === 'Pirogue test DB' && row?.risk_level === 'CRITIQUE');
    check('Anomalies JSONB relues en tableau', Array.isArray(row?.anomalies) && row.anomalies.length === 2);
    check('Empreinte du diagnostic stockée', typeof row?.ai_metadata?.diagnostic_hash === 'string');
    check(
      'Contrainte de domaine respectée',
      ['FAIBLE', 'MOYEN', 'ELEVE', 'CRITIQUE'].includes(row?.risk_level),
      row?.risk_level,
    );

    // Nettoyage : le test ne laisse rien derrière lui.
    await query('DELETE FROM inspections WHERE id = $1', [id]);
    const { rows: after } = await query('SELECT 1 FROM inspections WHERE id = $1', [id]);
    check('Nettoyage', after.length === 0);
  }
} catch (error) {
  console.error('Test interrompu :', error.message, error.details ?? '');
  process.exitCode = 1;
} finally {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} vérifications réussies.`);
  if (failed.length) process.exitCode = 1;
  await closePool();
}
