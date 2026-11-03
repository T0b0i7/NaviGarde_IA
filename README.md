# NaviGarde IA 🚢🛟

> **Cockpit maritime intelligent de supervision et d'inspection** — contrôle des embarcations, alertes d'urgence et bulletins maritimes, assistés par IA avec validation humaine obligatoire.

Conçu pour les autorités maritimes (contexte béninois, `@navigarde.bj`), NaviGarde s'inspire des centres opérationnels nord-américains et nippons : chaque analyse produite par l'IA (inspection photo, triage vocal, explicabilité des indicateurs) passe une **revue d'un agent humain** avant d'être validée.

---

## ✨ Fonctionnalités

| Module | Description |
|---|---|
| 📸 **Inspections assistées par IA** | L'agent photographie l'embarcation → l'IA détecte passagers, gilets de sauvetage visibles, anomalies coque/moteur → score de risque + confiance → rapport prêts à valider (statuts `a_verifier` / `validee` / `rejetee`) |
| 🎙️ **Alerte marin** | Page publique sans connexion (`/marin/alerte`) : triage vocal par IA, cas urgents transférés à un humain |
| 🚨 **Centre d'alertes** | Alertes agent / marin / IA / météo / système, affectation, transitions de statut, historique complet |
| ⛵ **Embarcations** | Référentiel complet : immatriculation, propriétaire, capacité, moteur, géolocalisation, statut (conforme / sous surveillance / immobilisée) |
| 📄 **Rapports officiels** | Versioning, validation à double contrôle, PDF avec empreinte SHA-256 |
| 📠 **Bulletins maritimes** | Création, publication et archivage des consignes |
| 🛰️ **Supervision prédictive** | Score de risque (météo + capacité déclarée), zones maritimes (exclusion, forte houle, pêche interdite, frontière) et **géofencing** (détection de franchissement via `vessel_positions`) |
| 📊 **Dashboard** | KPI agrégés MySQL (24 h / 7 j / 30 j) + analyse IA d'explicabilité des graphes |
| 🔒 **Sécurité & traçabilité** | RBAC 4 rôles côté serveur, journal d'audit, sessions scrypt, réinitialisation de mot de passe |

## 🧰 Stack technique

- **Front** — React 19 · TypeScript 5.9 · Vite 7 · Wouter · Tailwind CSS v4 · shadcn/Radix UI · Recharts 3 · Framer Motion · TanStack Query v5
- **Back** — Node 22 · Express 4 · tRPC 11 (+ superjson) · helmet · express-rate-limit · pino (logs structurés)
- **Base de données** — MySQL via Drizzle ORM + mysql2, migrations versionnées drizzle-kit
- **IA** — Baseten (modèle *Muse Spark* : analyse d'images, génération de rapport, transcription/triage vocal, analyse de dashboard) — appels **uniquement côté serveur**, clé jamais exposée
- **Stockage** — Forge Storage / S3 (images et PDF servis via `/manus-storage/`)
- **Qualité** — Vitest · eslint 9 · prettier · `tsc --noEmit`

## 📐 Architecture

```
client/          → SPA React (14 routes : dashboard, inspections, alertes,
                   rapports, embarcations, bulletins, utilisateurs, audit…)
server/          → Express + routeurs tRPC
  routers.ts       ai · data · predictive · auth
  _core/           auth local (scrypt + cookie de session), config publique
shared/          → schémas zod, constantes, matrice RBAC
drizzle/         → schéma (18 tables) et migrations MySQL
scripts/         → seed démo
```

Un seul serveur HTTP : middleware Vite en développement, statiques buildées (esbuild) en production.

## 🚀 Démarrage

```bash
pnpm install

# 1. Configurer l'environnement
cp .env.example .env
#   DATABASE_URL      mysql://user:pass@localhost:3306/navigarde
#   FORGE_API_URL / FORGE_API_KEY — stockage, LLM, notifications
#   BASETEN_API_KEY   — analyses IA

# 2. Créer le schéma et les données de démo
pnpm db:migrate && pnpm db:seed

# 3. Lancer
pnpm dev        # http://localhost:3000 (variable PORT configurable)
```

Comptes de démo (après `db:seed`) :

| Rôle | Compte |
|---|---|
| Admin | `thomas.adje@navigarde.bj` |
| Supervisor | `adelaide.hounde@navigarde.bj` |
| Agent | `koffi.dossa@navigarde.bj` |

## 📜 Scripts

| Commande | Rôle |
|---|---|
| `pnpm dev` | Serveur de développement (watch tsx) |
| `pnpm build` / `pnpm start` | Build et service de `dist/index.js` + `dist/public/` |
| `pnpm db:migrate` | Applique les migrations définies |
| `pnpm db:push` | Génère et applique les changements de schéma |
| `pnpm db:seed` | Injecte le jeu de données de démonstration |
| `pnpm check` | Vérification des types (`tsc --noEmit`) |
| `pnpm lint` / `pnpm format` | ESLint / Prettier |
| `pnpm test` | Tests Vitest (auth, RBAC, sécurité, intégration) |

## 🔑 Authentification & RBAC

- Connexion locale : **scrypt + sel**, limitation à 5 échecs / 15 min (par IP + email), événement d'audit `auth.login`
- Session par cookie `navigarde_session` HttpOnly (7 jours) — seul le **hash** du token est stocké en base
- Quatre rôles métier (`agent`, `supervisor`, `admin`, `observer`) — contrôle **serveur** effectif sur les procédures tRPC sensibles (`supervisorProcedure`, `adminAppProcedure`…)
- Réinitialisation de mot de passe : token haché à usage unique, expire en 30 minutes

## 🧭 État du projet / limites connues

- Les Google Maps sont **désactivées** (composant conservé, endpoint du fournisseur supprimé)
- Certaines pages gardent des **données de démonstration** (Home, Operations)
- Pas de temps réel (SSE/WebSocket) ni de clés étrangères déclarées côté Drizzle — voir `AUDIT.md` et `TODO.md`
- `AUDIT.md` · `FUNCTIONAL_MATRIX.md` · `DATABASE.md` · `DEPLOYMENT.md` documentent l'état détaillé

## 📄 Licence

MIT
