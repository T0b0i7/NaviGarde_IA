/**
 * Initialisation du schéma PostgreSQL.
 * Usage : npm run db:init
 *
 * Le script rejoue `database/init.sql` (idempotent) puis vérifie la présence
 * des trois tables. Il échoue proprement avec un message actionnable.
 */

import 'dotenv/config';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { closePool, getDbStatus, pool, query } from '../config/db.js';

const here = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(here, '..', '..', 'database', 'init.sql');

async function main() {
  if (!pool) {
    console.error('DB_ENABLED=false : rien à initialiser.');
    process.exitCode = 1;
    return;
  }

  const sql = await readFile(schemaPath, 'utf8');
  console.log(`[db:init] Application de ${schemaPath}…`);

  await pool.query(sql);
  console.log('[db:init] Schéma appliqué.');

  // Migrations incrémentales, dans l'ordre alphabétique (002_, 003_…).
  const migrationsDir = join(here, '..', '..', 'database', 'migrations');
  const migrations = (await readdir(migrationsDir).catch(() => []))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of migrations) {
    const migrationSql = await readFile(join(migrationsDir, file), 'utf8');
    await pool.query(migrationSql);
    console.log(`[db:init] Migration appliquée : ${file}`);
  }

  const { rows } = await query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('inspections', 'alerts', 'reports')
      ORDER BY table_name`,
  );

  const found = rows.map((row) => row.table_name);
  console.log(`[db:init] Tables présentes : ${found.join(', ') || 'aucune'}`);

  if (found.length !== 3) {
    console.error('[db:init] Une table manque : vérifiez les droits et la version de PostgreSQL.');
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error('[db:init] Échec :', error.message);
    const status = getDbStatus();
    if (status.status === 'unavailable') {
      console.error(
        `[db:init] Vérifiez PGUSER/PGHOST/PGPASSWORD/PGDATABASE/PGPORT dans .env — ${status.last_error}`,
      );
    }
    process.exitCode = 1;
  })
  .finally(closePool);
