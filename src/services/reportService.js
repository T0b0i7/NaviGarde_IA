/**
 * Module Rapport officiel (EF-30 à EF-37).
 *
 * Chaîne : inspection (+ alerte facultative) → rédaction Muse Wonder →
 * empreinte SHA-256 → persistance → validation superviseur (verrouillage).
 * Le hash est recalculé à chaque lecture : toute altération est détectable.
 */

import { createHash, randomUUID } from 'node:crypto';
import * as aiClient from '../ai/aiClient.js';
import { HttpError } from '../lib/httpError.js';
import { buildReportPdf } from './pdfService.js';
import { findAlert } from '../repositories/alertRepository.js';
import { findInspection } from '../repositories/inspectionRepository.js';
import {
  createVersion,
  findReport,
  saveReport,
  updateDraft,
  validateReport,
} from '../repositories/reportRepository.js';

const REPORT_TYPES = ['infraction', 'inspection', 'incident'];

/** Empreinte SHA-256 hexadécimale du texte final (EF-34). */
export function hashContent(text) {
  return createHash('sha256').update(String(text), 'utf8').digest('hex');
}

/**
 * Génère et enregistre un rapport.
 *
 * @param {{ inspectionId: string, alertId?: string|null, type?: string }} params
 * @returns {Promise<object>}
 */
export async function generateReportFor({ inspectionId, alertId = null, type = 'inspection' }) {
  const reportType = REPORT_TYPES.includes(type) ? type : 'inspection';

  const inspection = await findInspection(inspectionId);
  if (!inspection) {
    throw new HttpError(404, 'INSPECTION_NOT_FOUND', 'Inspection introuvable pour cet identifiant.');
  }

  let alert = null;
  if (alertId) {
    alert = await findAlert(alertId);
    if (!alert) {
      throw new HttpError(404, 'ALERT_NOT_FOUND', 'Alerte introuvable pour cet identifiant.');
    }
  }

  const generated = await aiClient.generateReport(toInspectionData(inspection), toAlertData(alert));
  const content = generated.content;
  const cryptographicHash = hashContent(content);

  const record = {
    id: randomUUID(),
    inspection_id: inspectionId,
    alert_id: alertId,
    generated_text: content,
    cryptographic_hash: cryptographicHash,
    report_type: reportType,
    status: 'brouillon',
    version: 1,
  };

  const persistence = await saveReport(record);

  return {
    status: 'success',
    report_id: record.id,
    inspection_id: inspectionId,
    alert_id: alertId,
    type: reportType,
    report_status: record.status,
    version: record.version,
    cryptographic_hash: cryptographicHash,
    hash_algorithm: 'sha256',
    content,
    meta: {
      ai_provider: generated.provider,
      model: generated.model,
      persistence: persistence.persisted,
      ...(persistence.reason ? { persistence_reason: persistence.reason } : {}),
      generated_at: new Date().toISOString(),
    },
  };
}

/**
 * Génère le PDF réglementaire d'un rapport (EF-34).
 * @returns {Promise<{ buffer: Buffer, filename: string, hash: string }>}
 */
export async function exportReportPdf(id) {
  const report = await findReport(id);
  if (!report) {
    throw new HttpError(404, 'REPORT_NOT_FOUND', 'Rapport introuvable.');
  }

  const buffer = await buildReportPdf(report);
  return {
    buffer,
    filename: `navigarde-rapport-${report.report_type}-v${report.version}-${id.slice(0, 8)}.pdf`,
    hash: report.cryptographic_hash,
  };
}

/** Relecture avec contrôle d'intégrité : le hash doit correspondre au texte. */
export async function readReport(id) {
  const report = await findReport(id);
  if (!report) {
    throw new HttpError(404, 'REPORT_NOT_FOUND', 'Rapport introuvable.');
  }

  const recomputed = hashContent(report.generated_text);
  return {
    status: 'success',
    report: shape(report),
    integrity: recomputed === report.cryptographic_hash ? 'ok' : 'altered',
    recomputed_hash: recomputed,
  };
}

/**
 * Édition d'un brouillon uniquement. Un rapport validé est immuable (EF-35) :
 * l'écriture est refusée atomiquement côté base, pas seulement côté service.
 */
export async function editDraft(id, newText) {
  const existing = await findReport(id);
  if (!existing) {
    throw new HttpError(404, 'REPORT_NOT_FOUND', 'Rapport introuvable.');
  }

  const cryptographicHash = hashContent(newText);

  // Rapport validé : on ne modifie jamais l'existant, on crée la version suivante (EF-35).
  if (existing.status === 'valide') {
    const version = await createVersion(id, newText, cryptographicHash);
    if (!version.record) {
      throw new HttpError(409, 'REPORT_NOT_VERSIONNABLE', 'Version antérieure introuvable.');
    }

    return {
      status: 'success',
      report_id: version.record.id,
      previous_report_id: id,
      version: version.record.version,
      report_status: 'brouillon',
      cryptographic_hash: cryptographicHash,
      content: newText,
      meta: { persistence: version.persisted, versioned: true },
    };
  }

  if (existing.status !== 'brouillon') {
    throw new HttpError(
      409,
      'REPORT_LOCKED',
      'Rapport soumis : attendez la validation ou créez une nouvelle version.',
    );
  }

  const result = await updateDraft(id, newText, cryptographicHash);

  if (!result.updated) {
    throw new HttpError(
      409,
      'REPORT_LOCKED',
      'Rapport validé : toute modification exige une nouvelle version.',
    );
  }

  return {
    status: 'success',
    report_id: id,
    report_status: 'brouillon',
    version: existing.version,
    cryptographic_hash: cryptographicHash,
    content: newText,
    meta: { persistence: result.persisted },
  };
}

/** Validation superviseur : verrouille le rapport et horodate la signature. */
export async function validate(id, validatedBy) {
  const result = await validateReport(id, validatedBy);
  if (!result.record) {
    throw new HttpError(
      409,
      'REPORT_NOT_VALIDATABLE',
      'Rapport introuvable ou déjà validé : aucune transition possible.',
    );
  }

  return {
    status: 'success',
    report: shape(result.record),
    meta: { persistence: result.persisted },
  };
}

function shape(report) {
  return {
    id: report.id,
    inspection_id: report.inspection_id,
    alert_id: report.alert_id,
    type: report.report_type,
    status: report.status,
    version: report.version,
    parent_report_id: report.parent_report_id ?? null,
    content: report.generated_text,
    cryptographic_hash: report.cryptographic_hash,
    validated_by: report.validated_by ?? null,
    validated_at: report.validated_at ?? null,
    created_at: report.created_at ?? null,
  };
}

function toInspectionData(row) {
  return {
    inspection_id: row.id,
    created_at: row.created_at,
    vessel: { name: row.vessel_name, type: row.vessel_type, location: row.location },
    risk_level: row.risk_level,
    analysis: {
      passengers_detected: row.passengers_detected,
      life_vests_detected: row.life_vests_detected,
      declared_capacity: row.declared_capacity,
      anomalies: row.anomalies ?? [],
      recommended_action: row.recommended_action,
    },
  };
}

function toAlertData(alert) {
  if (!alert) return null;
  return {
    id: alert.id,
    urgency: alert.urgency,
    summary: alert.summary,
    transcript: alert.transcription,
    extracted: alert.extracted ?? {},
  };
}
