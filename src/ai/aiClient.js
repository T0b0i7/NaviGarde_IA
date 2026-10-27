/**
 * Couche d'abstraction IA — section 7.3 du cahier des charges.
 *
 * Seul module autorisé à connaître les endpoints des modèles. Chaque fonction a
 * une implémentation `mock` (déterministe, sans réseau) et une implémentation
 * `meta` (appel HTTP réel). La logique métier ne connaît que ces signatures.
 *
 * Basculement : `AI_PROVIDER=mock|meta`. En cas d'échec réseau du mode `meta`,
 * l'appelant reçoit une HttpError 502 explicite ; le mode simulé reste disponible
 * pour la démo de secours (test T14).
 */

import { z } from 'zod';
import { HttpError } from '../lib/httpError.js';
import {
  ALERT_CLASSIFICATION_PROMPT,
  SAFETY_ANALYSIS_PROMPT,
  SEGMENT_CATEGORIES,
} from './prompts.js';
import { buildMockReport } from './reportTemplate.js';

const PROVIDER = (process.env.AI_PROVIDER ?? 'mock').toLowerCase();
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS ?? 20000);
const MOCK_SCENARIO = (process.env.MOCK_SCENARIO ?? 'critical').toLowerCase();

/** Nom et version des modèles : tracés avec chaque résultat (section 11). */
export const MODELS = Object.freeze({
  segmentation: { name: 'SAM 3.1', version: process.env.SAM3_VERSION ?? 'unknown' },
  safety: { name: 'Muse Spark', version: process.env.MUSE_SPARK_VERSION ?? 'unknown' },
  audio: { name: 'Muse Voice Transcribe', version: process.env.MUSE_VOICE_VERSION ?? 'unknown' },
  report: { name: 'Muse Wonder', version: process.env.MUSE_WONDER_VERSION ?? 'unknown' },
});

/* -------------------------------------------------------------------------- */
/* Schémas de validation des sorties IA                                       */
/* -------------------------------------------------------------------------- */

const segmentSchema = z.object({
  category: z.enum(SEGMENT_CATEGORIES),
  count: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
  boxes: z
    .array(
      z.object({
        x: z.number(),
        y: z.number(),
        w: z.number(),
        h: z.number(),
        score: z.number().min(0).max(1),
      }),
    )
    .default([]),
});

const segmentationResultSchema = z.object({
  segments: z.array(segmentSchema),
});

const safetyAnalysisSchema = z.object({
  passengers_detected: z.number().int().min(0).nullable(),
  life_vests_detected: z.number().int().min(0).nullable(),
  hull_anomaly_suspected: z.boolean(),
  undeterminable: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  notes: z.string().default(''),
});

/* -------------------------------------------------------------------------- */
/* Segmentation (SAM 3.1)                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Segmente une image par catégorie d'objets.
 *
 * @param {Buffer} image contenu binaire de l'image
 * @param {string} mimeType type MIME réel (détecté, pas déclaré)
 * @returns {Promise<{ provider: string, model: object, segments: Array<object> }>}
 */
export async function segmentImage(image, mimeType) {
  if (PROVIDER === 'meta') {
    const endpoint = requireEndpoint('SAM3_ENDPOINT');
    const payload = await postJson(endpoint, {
      image: image.toString('base64'),
      mime_type: mimeType,
      categories: SEGMENT_CATEGORIES,
    });
    return {
      provider: 'meta',
      model: MODELS.segmentation,
      ...segmentationResultSchema.parse(payload),
    };
  }

  return {
    provider: 'mock',
    model: MODELS.segmentation,
    segments: mockSegments(),
  };
}

/* -------------------------------------------------------------------------- */
/* Raisonnement de sécurité (Muse Spark)                                      */
/* -------------------------------------------------------------------------- */

/**
 * Analyse l'image et ses masques pour produire un diagnostic de sécurité.
 *
 * @param {{ image: Buffer, mimeType: string, segments: Array<object>,
 *           declaredCapacity: number }} params
 * @returns {Promise<{ provider: string, model: object, analysis: object }>}
 */
export async function analyzeSafety({ image, mimeType, segments, declaredCapacity }) {
  if (PROVIDER === 'meta') {
    const endpoint = requireEndpoint('MUSE_SPARK_ENDPOINT');
    const payload = await postJson(endpoint, {
      model: MODELS.safety.name,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      prompt: SAFETY_ANALYSIS_PROMPT,
      declared_capacity: declaredCapacity,
      image: image.toString('base64'),
      mime_type: mimeType,
      segments,
    });
    return {
      provider: 'meta',
      model: MODELS.safety,
      analysis: safetyAnalysisSchema.parse(parseJsonContent(payload)),
    };
  }

  return {
    provider: 'mock',
    model: MODELS.safety,
    analysis: mockSafetyAnalysis(segments, declaredCapacity),
  };
}

/* -------------------------------------------------------------------------- */
/* Audio (Muse Voice Transcribe) — Phase 3                                    */
/* -------------------------------------------------------------------------- */

/**
 * Transcrit un message vocal et détecte la langue.
 *
 * @param {Buffer} audio
 * @param {string} mimeType
 * @returns {Promise<{ provider: string, model: object, transcript: string, language: string }>}
 */
export async function transcribeAudio(audio, mimeType = 'audio/wav') {
  if (PROVIDER === 'meta') {
    const endpoint = requireEndpoint('MUSE_VOICE_ENDPOINT');
    const payload = await postJson(endpoint, {
      model: MODELS.audio.name,
      audio: audio.toString('base64'),
      mime_type: mimeType,
      detect_language: true,
    });
    return {
      provider: 'meta',
      model: MODELS.audio,
      transcript: payload.transcript ?? '',
      language: payload.language ?? 'und',
    };
  }

  return {
    provider: 'mock',
    model: MODELS.audio,
    transcript:
      "Le moteur est tombé en panne, nous dérivons près de la lagune, nous sommes sept à bord.",
    language: 'fr',
  };
}

/**
 * Analyse sémantique d'une transcription de message vocal (Muse Spark Open).
 * La sortie est alignée sur les colonnes `urgency`, `language`, `summary` de `alerts`.
 *
 * @param {string} text transcription produite par `transcribeAudio`
 * @returns {Promise<{ provider: string, model: object, analysis: object }>}
 */
export async function analyzeAudioContext(text) {
  const transcript = String(text ?? '').trim();

  if (PROVIDER === 'meta') {
    const endpoint = process.env.MUSE_SPARK_OPEN_ENDPOINT ?? process.env.MUSE_SPARK_ENDPOINT;
    if (!endpoint) {
      throw new HttpError(
        503,
        'AI_NOT_CONFIGURED',
        'Endpoint MUSE_SPARK_OPEN_ENDPOINT non configuré.',
      );
    }

    const payload = await postJson(endpoint, {
      model: MODELS.safety.name,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      prompt: ALERT_CLASSIFICATION_PROMPT,
      transcript,
    });

    return {
      provider: 'meta',
      model: MODELS.safety,
      analysis: normalizeAudioAnalysis(parseJsonContent(payload), transcript),
    };
  }

  return {
    provider: 'mock',
    model: MODELS.safety,
    analysis: mockAudioAnalysis(transcript),
  };
}

/* -------------------------------------------------------------------------- */
/* Rédaction de rapport (Muse Wonder) — Phase 3/4                             */
/* -------------------------------------------------------------------------- */

/**
 * Génère le corps d'un rapport officiel à partir de données structurées.
 * N'utilise que les faits fournis ; tout champ absent devient « non renseigné ».
 *
 * @param {object} payload données d'inspection et d'alerte
 * @returns {Promise<{ provider: string, model: object, content: string }>}
 */
export async function generateReport(inspectionData = {}, alertData = null) {
  const payload = { inspection: inspectionData, alert: alertData };

  if (PROVIDER === 'meta') {
    const endpoint = requireEndpoint('MUSE_WONDER_ENDPOINT');
    const result = await postJson(endpoint, {
      model: MODELS.report.name,
      temperature: 0.2,
      prompt: buildReportPrompt(payload),
    });
    const content = extractReportText(result);
    if (!content) {
      throw new HttpError(502, 'AI_INVALID_OUTPUT', 'Rapport vide renvoyé par Muse Wonder.');
    }
    return { provider: 'meta', model: MODELS.report, content };
  }

  return {
    provider: 'mock',
    model: MODELS.report,
    content: buildMockReport(inspectionData, alertData),
  };
}

/* -------------------------------------------------------------------------- */
/* Transport HTTP                                                             */
/* -------------------------------------------------------------------------- */

async function postJson(url, body) {
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.META_API_KEY
          ? { authorization: `Bearer ${process.env.META_API_KEY}` }
          : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (cause) {
    throw new HttpError(
      502,
      'AI_UNREACHABLE',
      "Le service d'inférence est injoignable. Réessayez ou basculez en mode simulé.",
      { endpoint: url, cause: cause?.message },
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new HttpError(502, 'AI_UPSTREAM_ERROR', "Le service d'inférence a renvoyé une erreur.", {
      status: response.status,
      detail: detail.slice(0, 500),
    });
  }

  return response.json();
}

/** Certains fournisseurs renvoient le JSON dans un champ texte. */
function parseJsonContent(payload) {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) return payload;
  if (typeof payload === 'string') return JSON.parse(payload);
  if (typeof payload?.content === 'string') return JSON.parse(payload.content);
  if (typeof payload?.output_text === 'string') return JSON.parse(payload.output_text);
  throw new HttpError(502, 'AI_INVALID_OUTPUT', "Réponse IA illisible : JSON attendu.");
}

function requireEndpoint(name) {
  const value = process.env[name];
  if (!value) {
    throw new HttpError(
      503,
      'AI_NOT_CONFIGURED',
      `Endpoint ${name} non configuré. Renseignez-le dans .env ou utilisez AI_PROVIDER=mock.`,
    );
  }
  return value;
}

/* -------------------------------------------------------------------------- */
/* Implémentations simulées                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Trois scénarios de démonstration, sélectionnés par `MOCK_SCENARIO` :
 *  - `critical`  : 12 passagers pour 8 places et 4 gilets  → CRITIQUE (T03)
 *  - `compliant` : 6 passagers, 6 gilets                  → FAIBLE   (T04)
 *  - `blurred`   : confiance basse                        → à vérifier (T05)
 */
function mockSegments() {
  const base = { critical: { people: 12, vests: 4 }, compliant: { people: 6, vests: 6 }, blurred: { people: 3, vests: 0 } }[
    MOCK_SCENARIO
  ] ?? { people: 12, vests: 4 };

  return [
    makeSegment('person', base.people),
    makeSegment('life_vest', base.vests),
    makeSegment('hull', 1),
    makeSegment('engine', 1),
    makeSegment('buoy', MOCK_SCENARIO === 'compliant' ? 2 : 0),
  ].filter((segment) => segment.count > 0);
}

function makeSegment(category, count) {
  return {
    category,
    count,
    confidence: MOCK_SCENARIO === 'blurred' ? 0.35 : 0.88,
    boxes: Array.from({ length: count }, (_, index) => ({
      x: 0.05 + ((index * 0.07) % 0.8),
      y: 0.2 + ((index * 0.11) % 0.6),
      w: 0.06,
      h: 0.12,
      score: MOCK_SCENARIO === 'blurred' ? 0.35 : 0.85,
    })),
  };
}

function mockSafetyAnalysis(segments, declaredCapacity) {
  const find = (category) => segments.find((s) => s.category === category)?.count ?? 0;
  const passengers = find('person');
  const vests = find('life_vest');

  const blurred = MOCK_SCENARIO === 'blurred';
  const confidence = blurred ? 0.35 : 0.82;

  return {
    passengers_detected: passengers,
    life_vests_detected: vests,
    hull_anomaly_suspected: false,
    undeterminable: blurred
      ? ['Image de qualité insuffisante : comptages non fiables', 'Visages et gilets partiellement occultés']
      : [],
    confidence,
    notes: blurred
      ? 'Image floue : validation humaine obligatoire.'
      : `${passengers} personnes et ${vests} gilets détectés pour ${declaredCapacity} places déclarées.`,
  };
}

/** Échelle d'urgence stockée dans `alerts.urgency`. */
export const URGENCY_SCALE = Object.freeze(['FAIBLE', 'MOYEN', 'ELEVE', 'CRITIQUE']);

/** Signaux vitaux : jamais dégradés automatiquement (règle de sécurité du CDC). */
const DISTRESS_PATTERN = /(coul|naufrag|noyade|homme à la mer|disparu|chavir|sombr)/i;
const URGENT_PATTERN = /(panne|avarie|dériv|voie d.eau|collision|moteur|remorqu|incendie)/i;
const MODERATE_PATTERN = /(météo|vent|houle|brouillard|orage|retard|essence)/i;

function severityRank(urgency) {
  return URGENCY_SCALE.indexOf(urgency);
}

/** Ramène la sortie du modèle à l'échelle et aux colonnes attendues. */
function normalizeAudioAnalysis(raw, transcript) {
  const input = raw?.analysis ?? raw ?? {};
  const legacy = { INFO: 'FAIBLE', URGENT: 'ELEVE', DETRESSE: 'CRITIQUE', 'DÉTRESSE': 'CRITIQUE' };
  const rawUrgency = String(input.urgency ?? '').toUpperCase();

  let urgency = URGENCY_SCALE.includes(legacy[rawUrgency] ?? rawUrgency)
    ? legacy[rawUrgency] ?? rawUrgency
    : 'MOYEN';

  if (DISTRESS_PATTERN.test(transcript) && severityRank(urgency) < severityRank('CRITIQUE')) {
    urgency = 'CRITIQUE';
  }

  return {
    urgency,
    language: normalizeLanguage(input.language),
    summary: limitSentences(input.summary, 2),
    type: normalizeType(input.type),
    extracted: normalizeExtracted(input.extracted),
  };
}

const ALERT_TYPES = [
  'PANNE_MOTEUR',
  'VOIE_EAU',
  'METEO_DANGEREUSE',
  'HOMME_A_LA_MER',
  'COLLISION',
  'AUTRE',
];

function normalizeLanguage(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  return /^[a-z]{2,5}$/.test(raw) ? raw : 'und';
}

function normalizeType(value) {
  const raw = String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  return ALERT_TYPES.includes(raw) ? raw : 'AUTRE';
}

/** Coupe un texte à `max` phrases, sans jamais renvoyer une chaîne vide. */
function limitSentences(text, max = 2) {
  const cleaned = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Aucune information exploitable dans le message.';

  const sentences = cleaned.match(/[^.!?]+[.!?]*/g) ?? [cleaned];
  return sentences.slice(0, max).join(' ').trim().slice(0, 600);
}

function normalizeExtracted(value) {
  const people = Number(value?.people_on_board);
  return {
    people_on_board: Number.isInteger(people) && people > 0 && people < 500 ? people : null,
    location_text: value?.location_text ? String(value.location_text).slice(0, 200) : null,
    need: value?.need ? String(value.need).slice(0, 200) : null,
  };
}

const NUMBER_WORDS = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5,
  six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
};

function detectPeople(transcript) {
  const digits = transcript.match(/\b(\d{1,3})\b/);
  if (digits) return Number(digits[1]);
  const words = transcript.toLowerCase().match(/\b(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\b/);
  return words ? NUMBER_WORDS[words[1]] : null;
}

/**
 * Analyse simulée, réellement réactive au texte : la même heuristique sert de
 * garde-fou quand le modèle réel renvoie une sortie incohérente.
 */
function mockAudioAnalysis(transcript) {
  const text = transcript.toLowerCase();

  const urgency = DISTRESS_PATTERN.test(text)
    ? 'CRITIQUE'
    : URGENT_PATTERN.test(text)
      ? 'ELEVE'
      : MODERATE_PATTERN.test(text)
        ? 'MOYEN'
        : 'FAIBLE';

  const type = /homme à la mer|disparu|noyade/.test(text)
    ? 'HOMME_A_LA_MER'
    : /voie d.eau|naufrag|coul/.test(text)
      ? 'VOIE_EAU'
      : /moteur|panne|avarie/.test(text)
        ? 'PANNE_MOTEUR'
        : /collision|abordage/.test(text)
          ? 'COLLISION'
          : /météo|vent|houle|orage/.test(text)
            ? 'METEO_DANGEREUSE'
            : 'AUTRE';

  const people = detectPeople(transcript);
  const locationMatch = text.match(/(près de|vers|à|au)\s+([^,.]+)/);
  const need = /remorqu/.test(text)
    ? 'remorquage'
    : /secours|sauvetage/.test(text)
      ? 'secours'
      : null;

  return {
    urgency,
    language: 'fr',
    summary: limitSentences(
      `Message vocal reçu : ${type.toLowerCase().replace(/_/g, ' ')}. ` +
        `${people ?? 'Nombre'} personne(s) à bord, ${locationMatch ? locationMatch[2].trim() : 'lieu non précisé'}.`,
      2,
    ),
    type,
    extracted: {
      people_on_board: people,
      location_text: locationMatch ? locationMatch[2].trim().slice(0, 200) : null,
      need,
    },
  };
}

/** Récupère le texte du rapport quel que soit l'emballage de la réponse. */
function extractReportText(result) {
  const text =
    result?.content ?? result?.text ?? result?.choices?.[0]?.message?.content ?? result?.output_text;
  return typeof text === 'string' ? text.trim() : '';
}

function buildReportPrompt(payload) {
  return `Tu rédiges un rapport officiel de sécurité maritime béninoise.
N'utilise QUE les données fournies ci-dessous. Tout champ absent doit être écrit
« non renseigné ». Aucune invention, ton administratif neutre, français.

Données : ${JSON.stringify(payload)}`;
}
