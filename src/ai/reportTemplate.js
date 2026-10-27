/**
 * Gabarit du rapport administratif (EF-32).
 * Règle de fiabilité : aucun fait n'est inventé, tout champ absent devient « non renseigné ».
 */

function or(value) {
  if (value === null || value === undefined || value === '') return 'non renseigné';
  return String(value);
}

export function buildMockReport(inspection = {}, alert = null) {
  const analysis = inspection.analysis ?? {};
  const vessel = inspection.vessel ?? {};

  const sections = [
    header(inspection, vessel, alert),
    identification(vessel, analysis, inspection),
    constats(analysis),
    risk(inspection, analysis),
    alert ? alertSection(alert) : null,
    measures(Boolean(alert)),
    `Signataire : ${or(inspection.validated_by)}`,
    'Rédigé avec assistance IA, vérifié par un agent.',
  ].filter(Boolean);

  return sections.join('\n\n');
}

function header(inspection, vessel, alert) {
  return [
    'RÉPUBLIQUE DU BÉNIN — NAVIGARDE IA',
    alert ? "RAPPORT D'INCIDENT ET DE SAUVETAGE" : "RAPPORT D'INSPECTION MARITIME",
    '',
    `Référence : ${or(inspection.inspection_id ?? inspection.id)}`,
    `Date : ${or(inspection.created_at ?? new Date().toISOString())}`,
    `Lieu : ${or(vessel.location ?? inspection.location)}`,
  ].join('\n');
}

function constats(analysis) {
  const anomalies =
    Array.isArray(analysis.anomalies) && analysis.anomalies.length
      ? analysis.anomalies.map((item) => `- ${item}`).join('\n')
      : '- Aucune anomalie relevée';

  return [
    '2. CONSTATS',
    `Passagers détectés : ${or(analysis.passengers_detected)}`,
    `Gilets de sauvetage détectés : ${or(analysis.life_vests_detected)}`,
    'Anomalies relevées :',
    anomalies,
  ].join('\n');
}

function risk(inspection, analysis) {
  return [
    '3. ANALYSE DE RISQUE',
    `Niveau de risque retenu : ${or(inspection.risk_level)}`,
    `Décision proposée : ${or(analysis.recommended_action)}`,
  ].join('\n');
}

function identification(vessel, analysis, inspection) {
  return [
    "1. IDENTIFICATION DE L'EMBARCATION",
    `Nom ou immatriculation : ${or(vessel.name ?? inspection.vessel_name)}`,
    `Type : ${or(vessel.type ?? inspection.vessel_type)}`,
    `Capacité déclarée : ${or(analysis.declared_capacity ?? inspection.declared_capacity)} passagers`,
  ].join('\n');
}

function alertSection(alert) {
  return [
    '4. ALERTE VOCALE LIÉE',
    `Urgence : ${or(alert.urgency)}`,
    `Synthèse : ${or(alert.summary)}`,
    `Personnes à bord déclarées : ${or(alert.extracted?.people_on_board)}`,
    `Lieu cité : ${or(alert.extracted?.location_text)}`,
  ].join('\n');
}

function measures(withAlert) {
  const number = withAlert ? 5 : 4;
  return [
    `${number}. MESURES RECOMMANDÉES`,
    'Contrôle de conformité à effectuer avant tout départ. Toute sanction ou refus de',
    "départ reste subordonné à la décision d'un agent assermenté.",
  ].join('\n');
}
