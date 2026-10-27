# NaviGarde IA (Maritime Safety & Port Logistics Infrastructure for Benin 🇧🇯)

NaviGarde IA is a multimodal AI infrastructure designed to strengthen maritime safety and port logistics for artisanal navigation in Benin. Built for the Meta Global AI Developer Hackathon 2026 under the theme "Build for Your World", it empowers field agents and port authorities with intelligent inspection workflows while preserving human oversight at every critical decision point.

## 💡 Problem Statement & Meta Themes

Artisanal pirogues are the backbone of inland and coastal transport in Benin, but they operate with minimal safety oversight. Overcrowding, missing life jackets, and structural anomalies put passengers at risk daily. Existing reporting is manual, slow, and prone to inconsistencies.

NaviGarde IA addresses this by:

- **Human-in-the-loop by design** – "L'IA propose, l'humain décide." No automatic penalties, refusals, or status changes without an authorized agent or supervisor.
- **Multimodal intelligence** – Combines computer vision (vessel inspection) and speech recognition (distress calls) into a unified safety workflow.
- **Sovereign traceability** – Every official report is cryptographically hashed and version-controlled to ensure full auditability.
- **Built for low-connectivity realities** – A resilient mock mode (AI_PROVIDER=mock) ensures uninterrupted demos and field testing.
- **Meta-first integration** – Leverages Meta's model ecosystem as the core reasoning engine, not a cosmetic wrapper.

## 🏗️ System Architecture & Multi-Agent Flow

NaviGarde IA follows a strict separation of concerns with a React SPA frontend calling a Node.js + Express backend. The frontend never calls Meta models directly – all inference goes through src/ai/aiClient.js.

```text
React (Vite + Tailwind) → Express /api/v1 → aiClient.js → Meta Inference Services
```

### Multi-Agent Pipeline

| Agent/Model | Role | Purpose |
| --- | --- | --- |
| SAM 3.1 (Segmentation) | Vision Segmentation | Detects and segments people, life vests, motors, hulls, and buoys from inspection photos. |
| Muse Spark (Reasoning) | Safety Reasoning | Counts passengers/vests, detects anomalies, computes risk levels (FAIBLE, MOYEN, ELEVE, CRITIQUE), and recommends actions with strict JSON output. |
| Muse Voice Transcribe (Audio) | Speech-to-Text | Transcribes distress calls from field agents/mariners with language detection. |
| Muse Wonder (Generation) | Report Generation | Drafts official administrative reports in the Beninese maritime format using only verified data. |

All four functions (segmentImage, analyzeSafety, transcribeAudio, generateReport) have real and simulated implementations, with all model metadata (provider/model/version/timestamp) persisted alongside results.

## 🔏 Sovereign Cryptographic Trust Chain

Trust and immutability are enforced at the data layer:

- **SHA-256 Integrity** – Every report's final content is hashed with crypto.createHash('sha256'). The hash is recalculated on read to detect tampering (integrity: 'ok' | 'altered').
- **Immutable Validation** – Once a report is marked valide by a supervisor, it cannot be edited. Any attempt triggers automatic versioning (EF-35).
- **Automatic Versioning** – PATCH /api/v1/reports/:id on a validated report clones it as a new brouillon with incremented version (v1 → v2 → v3), linking via parent_report_id.
- **Regulatory PDF Export** – GET /api/v1/reports/:id/download generates a tamper-evident PDF with the cryptographic hash displayed prominently in the footer as a sovereignty seal, QR code pointing to the public verification endpoint, and embedded metadata.
- **Traceable Signatures** – Validations capture validated_by and validated_at with atomic DB constraints preventing invalid transitions.
- **Persistence Resilience** – Postgres-first with memory fallback in dev; DB_REQUIRED=true enforces 503 in production to prevent false successes.

## 🚀 Installation & Local Smoke Testing

### Prerequisites
- Node.js >= 20
- PostgreSQL (optional for full persistence; memory fallback available)
- Git

### Backend Setup
```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Set AI_PROVIDER=mock for local development

# Initialize database (if using Postgres)
npm run db:init

# Start backend
npm run dev
```

### Frontend Setup (Vite + Tailwind)
```bash
# In a separate terminal
cd client
npm install
npm run dev
```

Frontend runs on http://localhost:5173 with proxy to backend http://localhost:3000. API routes: /api/v1/*.

### Smoke Tests
```bash
# Inspection flow
npm run test:smoke

# Audio/alerts
npm run test:audio

# Reports & integrity
npm run test:reports

# PDF export + versioning
npm run test:pdf

# DB persistence
npm run test:db
```

All tests run against AI_PROVIDER=mock by default and validate the end-to-end pipeline with strict assertions.

## 📄 License
MIT

Built with ❤️ for Benin's maritime community. L'IA propose, l'humain décide.
