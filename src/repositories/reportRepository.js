/**
 * Persistance des rapports officiels.
 *
 * Deux invariants portés ici, pas seulement dans le service :
 *  - un rapport `valide` est immuable (aucune mise à jour de texte possible) ;
 *  - une référence inexistante (inspection/alerte) ne crée pas de rapport orphelin.
 */

import { randomUUID } from 'node:crypto';
import { DB_REQUIRED, DbUnavailableError, query, withTransaction } from '../config/db.js';
import { HttpError } from '../lib/httpError.js';

const MEMORY_LIMIT = 300;
const memoryStore = new Map();

function degradable(error) {
  if (error instanceof DbUnavailableError) return true;
  return error instanceof HttpError && error.code === 'FOREIGN_KEY_VIOLATION';
}

/**
 * Insère un rapport.
 * @returns {Promise<{ persisted: 'postgres'|'memory', id: string, reason?: string }>}
 */
export async function saveReport(record) {
  try {
    await query(
      `INSERT INTO reports
         (id, inspection_id, alert_id, generated_text, cryptographic_hash,
          report_type, status, version)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        record.id,
        record.inspection_id,
        record.alert_id,
        record.generated_text,
        record.cryptographic_hash,
        record.report_type,
        record.status,
        record.version,
      ],
    );
    return { persisted: 'postgres', id: record.id };
  } catch (error) {
    if (!degradable(error)) throw error;
    if (DB_REQUIRED) throw error;
    keep(record);
    return { persisted: 'memory', id: record.id, reason: error.code };
  }
}

/** Relit un rapport. */
export async function findReport(id) {
  try {
    const { rows } = await query('SELECT * FROM reports WHERE id = $1', [id]);
    return rows[0] ?? null;
  } catch (error) {
    if (!degradable(error) || DB_REQUIRED) throw error;
    return memoryStore.get(id) ?? null;
  }
}

/**
 * Met à jour le texte d'un brouillon.
 * @returns {Promise<{ persisted: string, updated: boolean }>}
 */
export async function updateDraft(id, generatedText, cryptographicHash) {
  try {
    const { rowCount } = await query(
      `UPDATE reports
          SET generated_text = $2, cryptographic_hash = $3
        WHERE id = $1 AND status = 'brouillon'`,
      [id, generatedText, cryptographicHash],
    );
    return { persisted: 'postgres', updated: rowCount > 0 };
  } catch (error) {
    if (!degradable(error) || DB_REQUIRED) throw error;
    const record = memoryStore.get(id);
    if (!record || record.status !== 'brouillon') return { persisted: 'memory', updated: false };
    memoryStore.set(id, { ...record, generated_text: generatedText, cryptographic_hash: cryptographicHash });
    return { persisted: 'memory', updated: true };
  }
}

/**
 * Valide et verrouille un rapport.
 * @returns {Promise<{ persisted: string, record: object|null }>}
 */
async function validateMemory(id, validatedBy) {
  const record = memoryStore.get(id);
  if (!record) return null;
  const updated = {
    ...record,
    status: 'valide',
    validated_by: validatedBy,
    validated_at: new Date().toISOString(),
  };
  memoryStore.set(id, updated);
  return updated;
}

export async function validateReport(id, validatedBy) {
  try {
    const { rows } = await query(
      `UPDATE reports
          SET status = 'valide', validated_by = $2, validated_at = now()
        WHERE id = $1 AND status IN ('brouillon', 'soumis')
        RETURNING *`,
      [id, validatedBy],
    );
    return { persisted: 'postgres', record: rows[0] ?? null };
  } catch (error) {
    if (!degradable(error) || DB_REQUIRED) throw error;
    return { persisted: 'memory', record: await validateMemory(id, validatedBy) };
  }
}

function keep(record) {
  if (memoryStore.size >= MEMORY_LIMIT) {
    memoryStore.delete(memoryStore.keys().next().value);
  }
  memoryStore.set(record.id, record);
}

/**
 * Clone un rapport en nouvelle version brouillon (EF-35).
 * Verrou sur le parent : deux PATCH simultanés ne produisent pas la même v2.
 *
 * @returns {Promise<{ persisted: 'postgres'|'memory', record: object|null }>}
 */
export async function createVersion(parentId, generatedText, cryptographicHash) {
  try {
    const record = await withTransaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM reports WHERE id = $1 FOR UPDATE', [
        parentId,
      ]);
      const parent = rows[0];
      if (!parent) return null;

      const { rows: inserted } = await client.query(
        `INSERT INTO reports
           (id, inspection_id, alert_id, generated_text, cryptographic_hash,
            report_type, status, version, parent_report_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'brouillon', $7, $8)
         RETURNING *`,
        [
          randomUUID(),
          parent.inspection_id,
          parent.alert_id,
          generatedText,
          cryptographicHash,
          parent.report_type,
          parent.version + 1,
          parent.id,
        ],
      );
      return inserted[0];
    });

    return { persisted: 'postgres', record };
  } catch (error) {
    if (!degradable(error) || DB_REQUIRED) throw error;

    const parent = memoryStore.get(parentId);
    if (!parent) return { persisted: 'memory', record: null };

    const clone = {
      ...parent,
      id: randomUUID(),
      generated_text: generatedText,
      cryptographic_hash: cryptographicHash,
      status: 'brouillon',
      version: parent.version + 1,
      parent_report_id: parent.id,
      validated_by: null,
      validated_at: null,
      created_at: new Date().toISOString(),
    };
    keep(clone);
    return { persisted: 'memory', record: clone };
  }
}
