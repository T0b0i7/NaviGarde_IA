/**
 * Orchestration de l'inspection visuelle — section 7.2 du cahier des charges.
 *
 * 1. réception et validation de l'image (faite en amont par la route)
 * 2. segmentation SAM 3.1
 * 3. analyse de sécurité Muse Spark (JSON strict)
 * 4. validation du JSON ; une nouvelle tentative, puis « analyse impossible »
 * 5. application des règles de risque
 * 6. persistance asynchrone du diagnostic (PostgreSQL, repli mémoire explicite)
 */

import { randomUUID } from 'node:crypto';
import * as aiClient from '../ai/aiClient.js';
import { HttpError } from '../lib/httpError.js';
import { saveInspection } from '../repositories/inspectionRepository.js';
import { RISK_THRESHOLDS, evaluateRisk } from './riskRules.js';

/** Statuts d'inspection (section 6.1). */
export const INSPECTION_STATUS = Object.freeze({
  ANALYZED: 'analysee',
  ANALYSIS_FAILED: 'analyse_impossible',
});

/**
 * Analyse une image d'embarcation et produit un diagnostic de sécurité.
 *
 * @param {object} params
 * @param {Buffer} params.image contenu binaire
 * @param {string} params.mimeType type MIME réellement détecté
 * @param {object} params.metadata métadonnées validées de l'inspection
 * @param {string} params.metadata.vessel_name
 * @param {string} params.metadata.vessel_type
 * @param {string} params.metadata.location
 * @param {number} params.metadata.declared_capacity
 * @returns {Promise<object>} résultat conforme au contrat de `POST /inspect`
 */
export async function runInspection({ image, mimeType, metadata }) {
  const declaredCapacity = metadata.declared_capacity;

  // 2. Segmentation
  const segmentation = await aiClient.segmentImage(image, mimeType);

  // 3 et 4. Raisonnement de sécurité, avec une nouvelle tentative si le JSON est invalide
  const safety = await analyzeWithRetry({
    image,
    mimeType,
    segments: segmentation.segments,
    declaredCapacity,
  });

  if (!safety.ok) {
    return persistResult(buildFailureResult({ metadata, segmentation, error: safety.error }));
  }

  const analysis = safety.analysis;
  const passengersDetected = analysis.passengers_detected;
  const vestsDetected = analysis.life_vests_detected;

  // Une IA qui n'a pas pu compter ne doit pas produire un verdict de risque.
  const countable = passengersDetected !== null && vestsDetected !== null;

  const risk = countable
    ? evaluateRisk({
        passengersDetected,
        vestsDetected,
        declaredCapacity,
        hullAnomalySuspected: analysis.hull_anomaly_suspected,
      })
    : null;

  const needsReview = !countable || analysis.confidence < RISK_THRESHOLDS.confidence;

  return persistResult({
    status: 'success',
    inspection_id: randomUUID(),
    risk_level: risk?.level ?? null,
    risk_label: risk?.label ?? null,
    confidence: analysis.confidence,
    needs_review: needsReview,
    analysis: {
      passengers_detected: passengersDetected,
      life_vests_detected: vestsDetected,
      declared_capacity: declaredCapacity,
      anomalies: risk?.anomalies ?? [
        "Analyse impossible : comptages non déterminables, saisie manuelle requise",
      ],
      undeterminable: analysis.undeterminable,
      recommended_action: risk?.recommended_action ?? 'A_VERIFIER',
      ratios: risk?.ratios ?? { passengers: null, vests: null },
      notes: analysis.notes,
    },
    vessel: {
      name: metadata.vessel_name,
      type: metadata.vessel_type,
      location: metadata.location,
    },
    segmentation: {
      provider: segmentation.provider,
      model: segmentation.model,
      segments: segmentation.segments,
    },
    meta: {
      inspection_status: INSPECTION_STATUS.ANALYZED,
      ai_provider: safety.provider,
      models: { segmentation: segmentation.model, safety: safety.model },
      generated_at: new Date().toISOString(),
      attempts: safety.attempts,
    },
  });
}

/**
 * Enregistre le diagnostic puis l'enrichit de son état de persistance.
 *
 * Le contrat de réponse reste identique (`inspection_id` en UUID v4) ; on ajoute
 * seulement `meta.persistence` (`postgres` ou `memory`) pour que l'appelant sache
 * si la donnée est durable. En production, une base obligatoire non joignable
 * remonte une 503 au lieu de laisser croire à un enregistrement réussi.
 *
 * @param {object} result résultat construit par `runInspection`
 * @returns {Promise<object>}
 */
async function persistResult(result) {
  const persistence = await saveInspection(result);

  return {
    ...result,
    meta: {
      ...result.meta,
      persistence: persistence.persisted,
      ...(persistence.reason ? { persistence_reason: persistence.reason } : {}),
    },
  };
}

/**
 * Appelle Muse Spark, valide la sortie, retente une fois en cas d'échec.
 *
 * @returns {Promise<{ ok: true, analysis: object, provider: string, model: object, attempts: number }
 *                 | { ok: false, error: Error, attempts: number }>}
 */
async function analyzeWithRetry(params) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const result = await aiClient.analyzeSafety(params);
      return { ok: true, ...result, attempts: attempt };
    } catch (error) {
      // Un endpoint absent ou injoignable n'a aucune chance de réussir au 2e essai.
      if (error instanceof HttpError && error.statusCode >= 500 && error.code !== 'AI_INVALID_OUTPUT') {
        throw error;
      }
      lastError = error;
    }
  }
  return { ok: false, error: lastError, attempts: 2 };
}

function buildFailureResult({ metadata, segmentation, error }) {
  return {
    status: 'success',
    inspection_id: randomUUID(),
    risk_level: null,
    risk_label: null,
    confidence: 0,
    needs_review: true,
    analysis: {
      passengers_detected: null,
      life_vests_detected: null,
      declared_capacity: metadata.declared_capacity,
      anomalies: [
        "Analyse impossible : le service IA n'a pas renvoyé un résultat exploitable",
        'Saisie manuelle des comptages requise',
      ],
      undeterminable: ['Analyse automatique indisponible'],
      recommended_action: 'A_VERIFIER',
      ratios: { passengers: null, vests: null },
      notes: error?.message ?? 'Erreur inconnue',
    },
    vessel: {
      name: metadata.vessel_name,
      type: metadata.vessel_type,
      location: metadata.location,
    },
    segmentation: {
      provider: segmentation.provider,
      model: segmentation.model,
      segments: segmentation.segments,
    },
    meta: {
      inspection_status: INSPECTION_STATUS.ANALYSIS_FAILED,
      ai_provider: segmentation.provider,
      models: { segmentation: segmentation.model },
      generated_at: new Date().toISOString(),
      attempts: 2,
    },
  };
}
