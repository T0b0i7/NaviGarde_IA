/**
 * Orchestration du copilote vocal (EF-20 à EF-27).
 * audio → stockage hors dossier public → transcription → analyse → persistance.
 * Aucune coordonnée n'est inventée : sans position fournie, `position` vaut null.
 */

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import * as aiClient from '../ai/aiClient.js';
import { audioExtension } from '../middleware/upload.js';
import { saveAlert } from '../repositories/alertRepository.js';

const UPLOAD_DIR = resolve(process.env.UPLOAD_DIR ?? './storage/uploads');

/**
 * @param {{ buffer: Buffer, mimeType: string, latitude?: number|null, longitude?: number|null }} params
 * @returns {Promise<object>} réponse conforme au contrat de `POST /voice-alert`
 */
export async function processVoiceAlert({ buffer, mimeType, latitude = null, longitude = null }) {
  const id = randomUUID();
  const audioPath = await storeAudio(id, buffer, mimeType);

  const transcription = await aiClient.transcribeAudio(buffer, mimeType);
  const context = await aiClient.analyzeAudioContext(transcription.transcript);
  const analysis = context.analysis;
  const language = analysis.language || transcription.language || 'und';

  const persistence = await saveAlert({
    id,
    inspection_id: null,
    transcription: transcription.transcript,
    classification: analysis.type,
    urgency: analysis.urgency,
    language,
    summary: analysis.summary,
    status: 'recue',
    audio_path: audioPath,
    audio_mime: mimeType,
    extracted: analysis.extracted,
    latitude,
    longitude,
  });

  return {
    status: 'success',
    alert_id: id,
    transcript: transcription.transcript,
    language,
    classification: { type: analysis.type, urgency: analysis.urgency },
    analysis: { urgency: analysis.urgency, language, summary: analysis.summary },
    extracted: analysis.extracted,
    position: latitude !== null && longitude !== null ? { latitude, longitude } : null,
    meta: {
      status: 'recue',
      ai_provider: context.provider,
      models: { audio: transcription.model, safety: context.model },
      persistence: persistence.persisted,
      ...(persistence.reason ? { persistence_reason: persistence.reason } : {}),
      generated_at: new Date().toISOString(),
    },
  };
}

/**
 * Écrit l'audio sur disque, hors du dossier public, avec un nom régénéré (section 12).
 * Un échec disque ne doit pas perdre l'alerte : on journalise et on continue sans audio.
 *
 * @returns {Promise<string|null>} chemin relatif enregistré en base
 */
async function storeAudio(id, buffer, mimeType) {
  const relativePath = join('alerts', `${id}.${audioExtension(mimeType)}`);

  try {
    const absoluteDir = join(UPLOAD_DIR, 'alerts');
    await mkdir(absoluteDir, { recursive: true });
    await writeFile(join(UPLOAD_DIR, relativePath), buffer, { mode: 0o600 });
    return relativePath;
  } catch (error) {
    console.warn(`[navigarde] audio non enregistré (${id}) : ${error.message}`);
    return null;
  }
}
