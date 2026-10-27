/**
 * Règles de calcul du niveau de risque — section 4.2 du cahier des charges.
 *
 * L'IA propose un niveau, ces règles le confrontent aux seuils métier.
 * L'agent a toujours le dernier mot : `recommended_action` est une proposition.
 */

export const RISK_LEVELS = Object.freeze({
  LOW: 'FAIBLE',
  MEDIUM: 'MOYEN',
  HIGH: 'ELEVE',
  CRITICAL: 'CRITIQUE',
});

/** Libellés accentués destinés à l'affichage (le code machine reste en ASCII). */
export const RISK_LABELS = Object.freeze({
  FAIBLE: 'Faible',
  MOYEN: 'Moyen',
  ELEVE: 'Élevé',
  CRITIQUE: 'Critique',
});

export const RECOMMENDED_ACTIONS = Object.freeze({
  AUTHORIZED: 'AUTORISE',
  CONDITIONAL: 'AUTORISE_SOUS_CONDITIONS',
  DEPARTURE_REFUSED: 'DEPART_REFUSE',
  MANUAL_REVIEW: 'A_VERIFIER',
});

/** Seuils, surchargeables par variables d'environnement. */
export const RISK_THRESHOLDS = Object.freeze({
  /** Au-delà de ce ratio passagers / capacité déclarée : critique. */
  overloadCritical: Number(process.env.RISK_OVERLOAD_CRITICAL ?? 1.2),
  /** En dessous de ce ratio gilets / passagers : critique. */
  vestsCritical: Number(process.env.RISK_VESTS_CRITICAL ?? 0.5),
  /** En dessous de ce ratio gilets / passagers : élevé. */
  vestsHigh: Number(process.env.RISK_VESTS_HIGH ?? 0.8),
  /** Seuil de confiance sous lequel une validation humaine est exigée (EF-17). */
  confidence: Number(process.env.CONFIDENCE_THRESHOLD ?? 0.6),
});

/**
 * @typedef {object} RiskInput
 * @property {number} passengersDetected passagers comptés sur l'image
 * @property {number} vestsDetected gilets de sauvetage comptés
 * @property {number} declaredCapacity capacité déclarée par l'agent
 * @property {boolean} [hullAnomalySuspected] anomalie de coque suspectée par l'IA
 */

/**
 * Évalue le niveau de risque à partir des comptages.
 *
 * @param {RiskInput} input
 * @returns {{ level: string, label: string, anomalies: string[], recommended_action: string,
 *             ratios: { passengers: number|null, vests: number|null } }}
 */
export function evaluateRisk({
  passengersDetected = 0,
  vestsDetected = 0,
  declaredCapacity = 0,
  hullAnomalySuspected = false,
} = {}) {
  const passengers = Math.max(0, Math.trunc(passengersDetected));
  const vests = Math.max(0, Math.trunc(vestsDetected));
  const capacity = Math.max(0, Math.trunc(declaredCapacity));

  const passengerRatio = capacity > 0 ? passengers / capacity : null;
  const vestRatio = passengers > 0 ? vests / passengers : null;

  const anomalies = [];
  const overloadCritical = passengerRatio !== null && passengerRatio > RISK_THRESHOLDS.overloadCritical;
  const overloaded = capacity > 0 && passengers > capacity;
  const vestsCritical = vestRatio !== null && vestRatio < RISK_THRESHOLDS.vestsCritical;
  const vestsHigh = vestRatio !== null && vestRatio < RISK_THRESHOLDS.vestsHigh;
  const vestsMedium = vestRatio !== null && vestRatio < 1;

  if (overloadCritical) {
    anomalies.push(
      `Surcharge détectée : ${passengers} passagers pour ${capacity} places déclarées`,
    );
  } else if (overloaded) {
    anomalies.push(`Capacité dépassée : ${passengers} passagers pour ${capacity} places déclarées`);
  }

  if (vestsCritical) {
    anomalies.push(
      `Équipement de sauvetage insuffisant : ${vests} gilets pour ${passengers} passagers`,
    );
  } else if (vestsHigh) {
    anomalies.push(
      `Gilets de sauvetage insuffisants : ${vests} gilets pour ${passengers} passagers`,
    );
  } else if (vestsMedium) {
    anomalies.push(
      `Gilets en nombre limite : ${vests} gilets pour ${passengers} passagers`,
    );
  }

  if (hullAnomalySuspected) {
    anomalies.push('Anomalie de coque suspectée : vérification visuelle requise');
  }

  /** @type {string} */
  let level;
  if (overloadCritical || vestsCritical) {
    level = RISK_LEVELS.CRITICAL;
  } else if (overloaded || vestsHigh) {
    level = RISK_LEVELS.HIGH;
  } else if (vestsMedium || hullAnomalySuspected) {
    level = RISK_LEVELS.MEDIUM;
  } else {
    level = RISK_LEVELS.LOW;
  }

  return {
    level,
    label: RISK_LABELS[level],
    anomalies,
    recommended_action: recommendAction(level),
    ratios: {
      passengers: passengerRatio === null ? null : round(passengerRatio),
      vests: vestRatio === null ? null : round(vestRatio),
    },
  };
}

/**
 * Traduit un niveau de risque en décision suggérée.
 * Une décision finale reste toujours humaine (EF-19).
 *
 * @param {string} level
 * @returns {string}
 */
export function recommendAction(level) {
  switch (level) {
    case RISK_LEVELS.CRITICAL:
    case RISK_LEVELS.HIGH:
      return RECOMMENDED_ACTIONS.DEPARTURE_REFUSED;
    case RISK_LEVELS.MEDIUM:
      return RECOMMENDED_ACTIONS.CONDITIONAL;
    default:
      return RECOMMENDED_ACTIONS.AUTHORIZED;
  }
}

function round(value) {
  return Math.round(value * 100) / 100;
}
