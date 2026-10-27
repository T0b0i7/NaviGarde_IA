/**
 * Persistance des alertes vocales — même modèle résilient que les inspections.
 * Repli mémoire si la base est indisponible et que DB_REQUIRED est false.
 */

import { DB_REQUIRED, DbUnavailableError, query } from '../config/db.js';

const MEMORY_LIMIT = 500;
const memoryStore = new Map();

/**
 * Insère une alerte issue du pipeline audio.
 * @param {object} record
 * @returns {Promise<{ persisted: 'postgres'|'memory', id: string, reason?: string }>}
 */
export async function saveAlert(record) {
  try {
    await query(
      `INSERT INTO alerts
         (id, inspection_id, transcription, classification, urgency, language,
          summary, status, audio_path, audio_mime, extracted, latitude, longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13)
       ON CONFLICT (id) DO NOTHING`,
      [
        record.id,
        record.inspection_id,
        record.transcription,
        record.classification,
        record.urgency,
        record.language,
        record.summary,
        record.status,
        record.audio_path,
        record.audio_mime,
        JSON.stringify(record.extracted),
        record.latitude,
        record.longitude,
      ],
    );
    return { persisted: 'postgres', id: record.id };
  } catch (error) {
    if (!(error instanceof DbUnavailableError)) throw error;
    if (DB_REQUIRED) throw error;
    keepInMemory(record);
    return { persisted: 'memory', id: record.id, reason: error.code };
  }
}

/** Relit une alerte (centre d'alertes du superviseur). */
export async function findAlert(id) {
  try {
    const { rows } = await query('SELECT * FROM alerts WHERE id = $1', [id]);
    return rows[0] ?? null;
  } catch (error) {
    if (!(error instanceof DbUnavailableError) || DB_REQUIRED) throw error;
    return memoryStore.get(id) ?? null;
  }
}

function keepInMemory(record) {
  if (memoryStore.size >= MEMORY_LIMIT) {
    memoryStore.delete(memoryStore.keys().next().value);
  }
  memoryStore.set(record.id, record);
}
