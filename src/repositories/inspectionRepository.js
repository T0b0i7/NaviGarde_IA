/**
 * Persistance des inspections.
 *
 * Le diagnostic est écrit en base dès qu'il est posé (exigence de l'étape 4).
 * Si PostgreSQL est indisponible et que la persistance n'est pas obligatoire
 * (`DB_REQUIRED=false`, la valeur par défaut hors production), l'enregistrement
 * est conservé en mémoire et la réponse l'annonce via `meta.persistence`.
 * En production, `DB_REQUIRED` vaut true : l'erreur remonte (503) au lieu d'être masquée.
 */

import { createHash } from 'node:crypto';
import { DB_REQUIRED, DbUnavailableError, query } from '../config/db.js';

/** Repli mémoire : borné pour ne pas gonfler le processus sur une longue démo. */
const MEMORY_LIMIT = 500;
const memoryStore = new Map();

/**
 * Insère une inspection issue du diagnostic.
 *
 * @param {object} result résultat produit par `runInspection`
 * @returns {Promise<{ persisted: 'postgres' | 'memory', id: string, reason?: string }>}
 */
export async function saveInspection(result) {
  const row = toRow(result);

  try {
    await query(
      `INSERT INTO inspections
         (id, vessel_name, vessel_type, location, declared_capacity,
          risk_level, anomalies, passengers_detected, life_vests_detected,
          confidence, needs_review, recommended_action, status, ai_metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [
        row.id,
        row.vessel_name,
        row.vessel_type,
        row.location,
        row.declared_capacity,
        row.risk_level,
        JSON.stringify(row.anomalies),
        row.passengers_detected,
        row.life_vests_detected,
        row.confidence,
        row.needs_review,
        row.recommended_action,
        row.status,
        JSON.stringify(row.ai_metadata),
      ],
    );

    return { persisted: 'postgres', id: row.id };
  } catch (error) {
    if (!(error instanceof DbUnavailableError)) throw error;
    if (DB_REQUIRED) throw error;

    keepInMemory(row);
    return { persisted: 'memory', id: row.id, reason: error.code };
  }
}

/**
 * Relit une inspection (utile au superviseur et à la génération de rapport).
 *
 * @param {string} id
 * @returns {Promise<object | null>}
 */
export async function findInspection(id) {
  try {
    const { rows } = await query('SELECT * FROM inspections WHERE id = $1', [id]);
    return rows[0] ?? null;
  } catch (error) {
    if (!(error instanceof DbUnavailableError) || DB_REQUIRED) throw error;
    return memoryStore.get(id) ?? null;
  }
}

/** Nombre d'inspections conservées en mémoire (diagnostic de dégradation). */
export function memoryFallbackSize() {
  return memoryStore.size;
}

function keepInMemory(row) {
  if (memoryStore.size >= MEMORY_LIMIT) {
    memoryStore.delete(memoryStore.keys().next().value);
  }
  memoryStore.set(row.id, row);
}

/**
 * Aplatit le résultat d'inspection vers les colonnes SQL.
 * Le hash est calculé localement pour conserver une empreinte stable du diagnostic.
 */
function toRow(result) {
  const analysis = result.analysis ?? {};

  return {
    id: result.inspection_id,
    vessel_name: result.vessel?.name ?? 'non renseigné',
    vessel_type: result.vessel?.type ?? 'pirogue',
    location: result.vessel?.location ?? 'non renseigné',
    declared_capacity: analysis.declared_capacity ?? 0,
    risk_level: result.risk_level ?? null,
    anomalies: Array.isArray(analysis.anomalies) ? analysis.anomalies : [],
    passengers_detected: analysis.passengers_detected ?? null,
    life_vests_detected: analysis.life_vests_detected ?? null,
    confidence: result.confidence ?? null,
    needs_review: result.needs_review ?? true,
    recommended_action: analysis.recommended_action ?? null,
    status: result.meta?.inspection_status ?? 'analysee',
    ai_metadata: {
      ...(result.meta ?? {}),
      diagnostic_hash: diagnosticHash(result),
    },
  };
}

/** Empreinte SHA-256 du diagnostic, pour détecter toute altération ultérieure. */
function diagnosticHash(result) {
  const payload = JSON.stringify({
    inspection_id: result.inspection_id,
    risk_level: result.risk_level,
    analysis: result.analysis,
  });
  return createHash('sha256').update(payload).digest('hex');
}
