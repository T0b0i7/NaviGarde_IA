/**
 * Accès PostgreSQL — pool unique partagé par toute l'API.
 *
 * Principes :
 *  - un seul `pg.Pool` pour tout le processus (pas de client par requête) ;
 *  - aucune connexion n'est ouverte à l'import : le serveur démarre même sans base ;
 *  - en cas d'indisponibilité, l'état est mémorisé et les tentatives sont espacées
 *    (`DB_RETRY_AFTER_MS`) pour ne pas payer un timeout à chaque requête ;
 *  - en développement, l'appelant peut dégrader proprement (voir `inspectionRepository`) ;
 *    en production, `DB_REQUIRED` vaut true par défaut : on échoue franchement.
 */

import 'dotenv/config';
import pg from 'pg';
import { HttpError } from '../lib/httpError.js';

const { Pool } = pg;

/** Erreur d'indisponibilité de la base : dégradable, jamais un bug de code. */
export class DbUnavailableError extends HttpError {
  /**
   * @param {string} code `PERSISTENCE_DISABLED`, `DB_UNAVAILABLE` ou `DB_SCHEMA_MISSING`
   * @param {string} message message lisible
   * @param {object} [details]
   */
  constructor(code, message, details) {
    super(503, code, message, details);
    this.name = 'DbUnavailableError';
  }
}

function readBool(value, fallback) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** Persistance activée ? `false` => tout reste en mémoire (tests, démo hors ligne). */
export const DB_ENABLED = readBool(process.env.DB_ENABLED, true);

/** Persistance obligatoire ? Par défaut : oui en production, non ailleurs. */
export const DB_REQUIRED = readBool(process.env.DB_REQUIRED, IS_PRODUCTION);

/** Fenêtre de calme après un échec de connexion. */
const RETRY_AFTER_MS = Number(process.env.DB_RETRY_AFTER_MS ?? 30_000);

/** Erreurs réseau / configuration : la base est considérée injoignable. */
const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'ENETUNREACH',
  '57P03', // cannot_connect_now
  '28P01', // invalid_password
  '28000', // invalid_authorization_specification
  '3D000', // invalid_catalog_name (base absente)
  '53300', // too_many_connections
]);

/** Schéma absent ou incomplet : traité comme une indisponibilité dégradable. */
const SCHEMA_ERROR_CODES = new Set([
  '42P01', // undefined_table
  '42703', // undefined_column
  '3F000', // invalid_schema_name
]);

const state = {
  status: DB_ENABLED ? 'unknown' : 'disabled',
  lastError: null,
  lastCheckAt: 0,
};

/** Pool unique. `null` quand la persistance est désactivée. */
export const pool = DB_ENABLED
  ? new Pool({
      user: process.env.PGUSER ?? 'postgres',
      host: process.env.PGHOST ?? 'localhost',
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE ?? 'navigarde_db',
      port: Number(process.env.PGPORT ?? 5432),
      max: Number(process.env.PGPOOL_MAX ?? 10),
      idleTimeoutMillis: Number(process.env.PGIDLE_TIMEOUT_MS ?? 10_000),
      connectionTimeoutMillis: Number(process.env.PGCONNECT_TIMEOUT_MS ?? 1500),
      application_name: 'navigarde-ia',
    })
  : null;

// Un client inactif qui tombe ne doit jamais faire planter le processus.
pool?.on('error', (error) => {
  markUnavailable(error);
});

/**
 * Refuse l'accès si la persistance est coupée ou en période de calme.
 * @throws {DbUnavailableError}
 */
function assertAvailable() {
  if (!DB_ENABLED) {
    throw new DbUnavailableError(
      'PERSISTENCE_DISABLED',
      'Persistance PostgreSQL désactivée (DB_ENABLED=false).',
    );
  }

  const cooldown = Date.now() - state.lastCheckAt < RETRY_AFTER_MS;
  if (state.status === 'unavailable' && cooldown) {
    throw new DbUnavailableError(
      'DB_UNAVAILABLE',
      `Base de données indisponible : ${state.lastError ?? 'raison inconnue'}`,
    );
  }
}

function markUnavailable(error) {
  const wasUnavailable = state.status === 'unavailable';
  state.status = 'unavailable';
  state.lastCheckAt = Date.now();
  state.lastError = shorten(error);

  if (!wasUnavailable) {
    console.warn(
      `[navigarde] PostgreSQL injoignable (${error?.code ?? 'sans code'}) : ${state.lastError}`,
    );
  }
}

function markConnected() {
  if (state.status !== 'connected') {
    console.log('[navigarde] PostgreSQL connecté.');
  }
  state.status = 'connected';
  state.lastError = null;
  state.lastCheckAt = Date.now();
}

function shorten(error) {
  const code = error?.code ? `${error.code} — ` : '';
  return `${code}${error?.message ?? 'erreur inconnue'}`.slice(0, 240);
}

/**
 * Traduit une erreur `pg` en erreur applicative.
 * @returns {HttpError}
 */
function translate(error) {
  if (CONNECTION_ERROR_CODES.has(error.code)) {
    markUnavailable(error);
    return new DbUnavailableError('DB_UNAVAILABLE', "La base de données est injoignable.", {
      pg_code: error.code,
      cause: shorten(error),
    });
  }

  if (SCHEMA_ERROR_CODES.has(error.code)) {
    markUnavailable(error);
    return new DbUnavailableError(
      'DB_SCHEMA_MISSING',
      "Le schéma de la base est absent ou incomplet. Exécutez « npm run db:init ».",
      { pg_code: error.code, cause: shorten(error) },
    );
  }

  if (error.code === '23503') {
    return new HttpError(409, 'FOREIGN_KEY_VIOLATION', 'Référence inexistante en base.', {
      pg_code: error.code,
      cause: shorten(error),
    });
  }

  return new HttpError(500, 'DB_ERROR', "Erreur SQL inattendue.", {
    pg_code: error.code,
    cause: shorten(error),
  });
}

/**
 * Exécute une requête paramétrée sur le pool.
 *
 * @param {string} text requête SQL avec placeholders `$1`, `$2`…
 * @param {unknown[]} [params]
 * @returns {Promise<import('pg').QueryResult>}
 * @throws {DbUnavailableError | HttpError}
 */
export async function query(text, params = []) {
  assertAvailable();

  try {
    const result = await pool.query(text, params);
    markConnected();
    return result;
  } catch (error) {
    throw translate(error);
  }
}

/**
 * Exécute une fonction dans une transaction, avec rollback automatique.
 *
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} work
 * @returns {Promise<T>}
 */
export async function withTransaction(work) {
  assertAvailable();

  let client;
  try {
    client = await pool.connect();
  } catch (error) {
    throw translate(error);
  }

  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    markConnected();
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error instanceof HttpError ? error : translate(error);
  } finally {
    client.release();
  }
}

/**
 * Vérifie la connexion. Ne lève jamais : renvoie false en cas d'échec.
 * @returns {Promise<boolean>}
 */
export async function ping() {
  try {
    await query('SELECT 1 AS ok');
    return true;
  } catch {
    return false;
  }
}

/** Photographie de l'état, destinée à `/health` (aucune I/O). */
export function getDbStatus() {
  return {
    enabled: DB_ENABLED,
    required: DB_REQUIRED,
    status: state.status,
    last_error: state.lastError,
    last_check_at: state.lastCheckAt ? new Date(state.lastCheckAt).toISOString() : null,
  };
}

/** Fermeture propre du pool (tests, arrêt du processus). */
export async function closePool() {
  await pool?.end().catch(() => {});
}
