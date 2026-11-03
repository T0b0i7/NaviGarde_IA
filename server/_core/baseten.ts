import { TRPCError } from "@trpc/server";

const BASE_URL = "https://inference.baseten.co/v1/chat/completions";
export const BASETEN_MODEL = "meta-models/muse-spark-open-1026";

type ChatMessage = { role: "system" | "user" | "assistant"; content: unknown };
type ChatResponse = { choices?: Array<{ message?: { content?: unknown; reasoning_content?: unknown } }> };

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part: any) => typeof part === "string" ? part : part?.text ?? "").join("\n");
  return "";
}

function localFallback(prompt: string): string | null {
  if (!process.env.BASETEN_API_KEY) return null;
  return null;
}
async function chat(messages: ChatMessage[], maxTokens = 900): Promise<string> {
  const apiKey = process.env.BASETEN_API_KEY;
  if (!apiKey) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Service IA non configure. Activez BASETEN_API_KEY ou utilisez le mode local." });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55_000);
  try {
    const response = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: BASETEN_MODEL, messages, temperature: 0.1, max_tokens: maxTokens }),
      signal: controller.signal,
    });
    const body = await response.text();
    if (!response.ok) {
      console.error("[Baseten] request failed", response.status);
      throw new TRPCError({ code: response.status === 401 ? "UNAUTHORIZED" : "BAD_GATEWAY", message: "Le service IA Baseten a refusé la demande." });
    }
    const payload = JSON.parse(body) as ChatResponse;
    const msg = payload.choices?.[0]?.message;
    let content = textFromContent(msg?.content);
    if (!content && msg?.reasoning_content) content = textFromContent(msg.reasoning_content);
    if (!content) throw new TRPCError({ code: "BAD_GATEWAY", message: "Le service IA a renvoyé une réponse vide." });
    return content;
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    console.error("[Baseten] network error", error);
    throw new TRPCError({ code: "TIMEOUT", message: "Le service IA est temporairement indisponible." });
  } finally {
    clearTimeout(timer);
  }
}

function extractJson<T>(raw: string): T {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  // 1) tentative directe sur le plus grand bloc { ... }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)) as T; } catch { /* suite */ }
  }
  // 2) extraction équilibrée : teste chaque bloc { ... } équilibré, du plus grand au plus petit
  const candidates: string[] = [];
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] !== "{") continue;
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < cleaned.length; j++) {
      const c = cleaned[j];
      if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; }
      else { if (c === '"') inStr = true; else if (c === "{") depth++; else if (c === "}") { depth--; if (depth === 0) { candidates.push(cleaned.slice(i, j + 1)); break; } } }
    }
  }
  candidates.sort((a, b) => b.length - a.length);
  for (const c of candidates) { try { return JSON.parse(c) as T; } catch { /* suivant */ } }
  throw new TRPCError({ code: "BAD_GATEWAY", message: "La réponse IA n’a pas pu être interprétée." });
}

export type InspectionAnalysis = {
  passengersDetected: number;
  lifejacketsVisible: number;
  capacityRisk: "faible" | "moyen" | "élevé" | "critique" | "à vérifier";
  riskScore: number;
  confidence: number;
  hull: "bon" | "à vérifier" | "endommagé" | "non visible";
  engine: "bon" | "à vérifier" | "endommagé" | "non visible";
  findings: string[];
  recommendation: string;
  uncertainty: string[];
};

function sanitizePrompt(input: string): string { return input.replace(/[<>"'`;\n\r]/g, " ").slice(0, 500); }
export async function analyzeInspection(input: { boat: string; type: string; capacity: number; place: string; images: string[] }): Promise<InspectionAnalysis> {
  const apiKey = process.env.BASETEN_API_KEY;
  if (!apiKey) {
    const cap = Math.max(0, input.capacity);
    const risk = cap > 40 ? 68 : cap > 20 ? 45 : 22;
    return { passengersDetected: Math.min(cap, 12), lifejacketsVisible: Math.min(cap, 10), capacityRisk: risk >= 60 ? "élevé" : risk >= 30 ? "moyen" : "faible", riskScore: risk, confidence: 42, hull: "à vérifier", engine: "à vérifier", findings: ["Analyse locale : IA distante non configuree, verification humaine requise."], recommendation: "Mode local actif : verifier manuellement gilets, coque et moteur avant validation.", uncertainty: ["IA distante indisponible"] };
  }
  const boat = sanitizePrompt(input.boat); const type = sanitizePrompt(input.type); const place = sanitizePrompt(input.place);
  const imageParts = input.images.slice(0, 5).map(url => ({ type: "image_url", image_url: { url } }));
  const prompt = `Tu es l’assistant de sécurité maritime NaviGarde IA au Bénin. Analyse les images d’une ${type} nommée ${boat}, capacité déclarée ${input.capacity} passagers, zone ${place}. Compte uniquement ce qui est visible. Ne déduis jamais une information invisible. Réponds avec un objet JSON strict, sans markdown, avec exactement ces champs : passengersDetected (entier), lifejacketsVisible (entier), capacityRisk (faible|moyen|élevé|critique), riskScore (0 à 100), confidence (0 à 100), hull (bon|à vérifier|endommagé|non visible), engine (bon|à vérifier|endommagé|non visible), findings (tableau de chaînes en français), recommendation (chaîne en français), uncertainty (tableau de chaînes en français). Si un élément n’est pas visible, utilise non visible et ajoute une incertitude.`;
  const raw = await chat([{ role: "system", content: "Tu produis des décisions explicables pour un agent humain. L’IA propose, l’humain décide." }, { role: "user", content: [{ type: "text", text: prompt }, ...imageParts] }], 5000);
  const parsed = extractJson<InspectionAnalysis>(raw);
  return {
    passengersDetected: Number.isFinite(parsed.passengersDetected) ? parsed.passengersDetected : 0,
    lifejacketsVisible: Number.isFinite(parsed.lifejacketsVisible) ? parsed.lifejacketsVisible : 0,
    capacityRisk: parsed.capacityRisk ?? "à vérifier",
    riskScore: Math.max(0, Math.min(100, Number(parsed.riskScore) || 0)),
    confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)),
    hull: parsed.hull ?? "non visible",
    engine: parsed.engine ?? "non visible",
    findings: Array.isArray(parsed.findings) ? parsed.findings.slice(0, 8) : [],
    recommendation: parsed.recommendation ?? "Vérification humaine recommandée.",
    uncertainty: Array.isArray(parsed.uncertainty) ? parsed.uncertainty.slice(0, 8) : [],
  };
}

export async function generateInspectionReport(input: { boat: string; type: string; capacity: number; place: string; agent: string; analysis: InspectionAnalysis }): Promise<string> {
  if (!process.env.BASETEN_API_KEY) {
    return `Objet: Rapport d'inspection ${sanitizePrompt(input.boat)}\nObservations: Analyse locale (IA distante non configuree). Donnees: ${input.place}, capacite ${input.capacity}, agent ${sanitizePrompt(input.agent)}.\nNiveau de risque: ${input.analysis.riskScore}/100\nRecommandations: ${input.analysis.recommendation}\nValidation humaine: Obligatoire.`;
  }
  const raw = await chat([{ role: "system", content: "Tu rédiges des rapports administratifs maritimes en français. Ne présentes jamais une hypothèse comme un fait. Mentionne que la validation humaine est obligatoire." }, { role: "user", content: `Rédige un rapport officiel court et structuré pour l’inspection de ${sanitizePrompt(input.boat)} (${sanitizePrompt(input.type)}), capacité ${input.capacity}, zone ${sanitizePrompt(input.place)}, agent ${sanitizePrompt(input.agent)}. Résultats IA : ${JSON.stringify(input.analysis)}. Utilise les sections Objet, Observations, Niveau de risque, Recommandations, Validation humaine. Pas de markdown complexe.` }], 3000);
  return raw.replace(/```/g, "").trim();
}

export type VoiceAlertAnalysis = { transcript: string; urgency: "information" | "élevée" | "détresse"; people: number | null; place: string | null; need: string; recommendation: string };

export async function analyzeVoiceAlert(audioDataUrl: string): Promise<VoiceAlertAnalysis> {
  if (!process.env.BASETEN_API_KEY) return { transcript: "Transcription locale : IA distante non configuree", urgency: "information", people: null, place: null, need: "autre", recommendation: "Ecoute humaine requise (mode local)." };
  const prompt = "Écoute cet enregistrement d’un marin béninois et réponds uniquement avec un objet JSON strict, sans markdown, avec exactement transcript (transcription française fidèle), urgency (information|élevée|détresse), people (entier ou null), place (lieu cité ou null), need (panne|secours|remorquage|météo|autre), recommendation (action courte pour le centre de contrôle). N’invente pas les éléments absents de l’audio.";
  const raw = await chat([{ role: "system", content: "Tu es l’opérateur de triage vocal de NaviGarde IA. Tu extrais seulement les faits audibles et tu transmets les cas urgents à un humain." }, { role: "user", content: [{ type: "text", text: prompt }, { type: "audio_url", audio_url: { url: audioDataUrl } }] }], 5000);
  const parsed = extractJson<VoiceAlertAnalysis>(raw);
  return { transcript: parsed.transcript ?? "", urgency: parsed.urgency ?? "information", people: typeof parsed.people === "number" ? parsed.people : null, place: parsed.place ?? null, need: parsed.need ?? "autre", recommendation: parsed.recommendation ?? "Écoute humaine recommandée." };
}

export type DashboardInsight = { headline: string; summary: string; severity: "info" | "attention" | "critique"; signals: string[]; actions: string[]; confidence: number };

export async function analyzeDashboard(input: { period: string; activity: unknown; risks: unknown; problems: unknown; delays: unknown; teamScore: number }): Promise<DashboardInsight> {
  if (!process.env.BASETEN_API_KEY) return { headline: "Lecture locale du cockpit", summary: "Mode local : croisez les KPI avec le terrain. IA distante non configuree.", severity: "info", signals: ["Mode local actif"], actions: ["Verifier les alertes et inspections recentes"], confidence: 42 };
  const raw = await chat([{ role: "system", content: "Tu es l’analyste de quart de NaviGarde IA. Tu interprètes des indicateurs opérationnels maritimes pour un superviseur béninois. Ne présentes jamais une corrélation comme une causalité certaine. Réponds en JSON strict." }, { role: "user", content: `Analyse le cockpit sur la période ${sanitizePrompt(input.period)}. Données: activité=${JSON.stringify(input.activity).slice(0, 4000)}, risques=${JSON.stringify(input.risks).slice(0, 2000)}. Réponds avec exactement headline (titre court en français), summary (3 phrases maximum), severity (info|attention|critique), signals (3 faits visibles maximum), actions (3 actions opérationnelles maximum), confidence (0 à 100).` }], 1400);
  const parsed = extractJson<DashboardInsight>(raw);
  return { headline: parsed.headline ?? "Lecture opérationnelle disponible", summary: parsed.summary ?? "Les indicateurs doivent être relus avec le contexte terrain.", severity: parsed.severity ?? "info", signals: Array.isArray(parsed.signals) ? parsed.signals.slice(0, 4) : [], actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 4) : [], confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 0)) };
}
