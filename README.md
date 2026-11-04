# NaviGarde IA 🚢🛟

> **Cockpit maritime intelligent de supervision et d'inspection** — contrôle des
> embarcations, alertes d'urgence et bulletins maritimes, assistés par IA avec
> validation humaine obligatoire.

Conçu pour les autorités maritimes (contexte béninois, `@navigarde.bj`),
NaviGarde s'inspire des centres opérationnels nord-américains et nippons :
chaque analyse produite par l'IA (inspection photo, triage vocal, explicabilité
des indicateurs) passe une **revue d'un agent humain** avant d'être validée.

🔗 Dépôt : <https://github.com/T0b0i7/NaviGarde_IA> ·
Page de présentation : <https://t0b0i7.github.io/NaviGarde_IA/>

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
| 🔒 **Sécurité & traçabilité** | RBAC 4 rôles côté serveur, journal d'audit, sessions scrypt, réinitialisation de mot de passe, protection CSRF |

## 🧰 Stack technique

- **Front** — React 19 · TypeScript 5.9 · Vite 7 · Wouter · Tailwind CSS v4 ·
  shadcn/Radix UI · Recharts 3 · Framer Motion · TanStack Query v5
- **Back** — Node 22 · Express 4 · tRPC 11 (+ superjson) · helmet ·
  express-rate-limit · pino (logs structurés)
- **Base de données** — MySQL (ou MariaDB) via Drizzle ORM + mysql2,
  migrations versionnées drizzle-kit
- **IA** — Baseten (modèle *Muse Spark* : analyse d'images, génération de
  rapport, transcription/triage vocal, analyse de dashboard) — appels
  **uniquement côté serveur**, clé jamais exposée
- **Stockage** — MySQL (`storage_objects`), survit au redéploiement
- **Qualité** — Vitest · eslint 9 · prettier · `tsc --noEmit` · CI GitHub Actions

## 📐 Architecture

```
client/          → SPA React (écrans chargés à la demande)
server/          → Express + routeurs tRPC
  routers.ts       ai · data · predictive · auth
  _core/           session scrypt, CSRF, validation d'env, métriques, logs
  storage.ts       stockage MySQL (LONGBLOB), repli disque en dev
  uploadRoutes.ts  /uploads/* servi depuis la base
shared/          → schémas zod, constantes, matrice RBAC
drizzle/         → schéma (20 tables) et 10 migrations MySQL
site/            → page vitrine publiée sur GitHub Pages
scripts/         → seed, migrations, vérifications (env, db, rôles, UI)
```

Un seul serveur HTTP : middleware Vite en développement, statiques buildées
(esbuild) en production.

## 🚀 Démarrage

```bash
pnpm install
cp .env.example .env         # renseigner DATABASE_URL (compte navigarde_app)
pnpm verify:env              # la configuration est-elle acceptable ?
pnpm db:migrate              # avec MIGRATION_DATABASE_URL
pnpm dev                     # http://localhost:3000/connexion
```

Comptes de test (après `pnpm tsx scripts/create-role-accounts.ts`) :

| Rôle | Compte | Mot de passe |
|---|---|---|
| Admin | `admin@navigarde.bj` | `Admin12345678!` |
| Superviseur | `superviseur@navigarde.bj` | `Superviseur123!` |
| Agent | `agent@navigarde.bj` | `Agent12345678!` |
| Observateur | `observateur@navigarde.bj` | `Observateur123!` |

## 📜 Scripts

| Commande | Rôle |
|---|---|
| `pnpm dev` | Serveur de développement (watch tsx) |
| `pnpm build` / `pnpm start` | Build et service de `dist/index.js` + `dist/public/` |
| `pnpm db:migrate` | Applique les migrations définies |
| `pnpm db:push` | Génère et applique les changements de schéma |
| `pnpm db:seed` | Injecte le jeu de données de démonstration (hors production) |
| `pnpm check` | Vérification des types (`tsc --noEmit`) |
| `pnpm lint` / `pnpm format` | ESLint / Prettier |
| `pnpm test` | Tests Vitest (62 tests) |
| `pnpm verify:env` | Contrôle de configuration avant déploiement |
| `pnpm verify:db` | Cycle CRUD réel avec le compte applicatif |
| `pnpm verify:roles` | Parcours navigateur des 4 rôles (Chrome requis) |
| `pnpm verify:ui` | Balayage des routes, débordements 1440 px / 390 px |
| `pnpm storage:migrate` | Migre `public/uploads` vers MySQL |

## 🔑 Authentification & RBAC

- Connexion locale : **scrypt + sel**, limitation à 5 échecs / 15 min par
  IP + e-mail **et** 10 échecs / 15 min par compte (une attaque distribuée qui
  change d'IP reste bloquée), événement d'audit `auth.login`
- Session par cookie `navigarde_session` HttpOnly (7 jours, 30 avec
  « se souvenir de moi ») — seul le **hash** du token est stocké en base
- **Protection CSRF** par double soumission : en-tête `x-csrf-token` exigé sur
  toute mutation authentifiée (la session peut être `SameSite=None`)
- Quatre rôles métier (`agent`, `supervisor`, `admin`, `observer`) — contrôle
  **serveur** sur les procédures tRPC sensibles (`supervisorProcedure`,
  `adminAppProcedure`, `operationalProcedure`…)
- Réinitialisation de mot de passe : token haché à usage unique, expire en 30
  minutes

## 🛡️ Exploitation

- **Aucun accès `root`** : l'application utilise `navigarde_app`
  (`SELECT/INSERT/UPDATE/DELETE`) et **refuse de démarrer** sur un
  superutilisateur. Les migrations passent par `navigarde_migrator`.
- **Stockage durable** : photos et PDF sont écrits dans MySQL, pas sur le
  disque du conteneur. `STORAGE_DRIVER=local` est refusé en production.
- **Observabilité** : `/api/health` interroge réellement MySQL (503 si la base
  tombe), `/api/metrics` expose compteurs et latences, toute réponse ≥ 500 est
  journalisée avec un `X-Request-Id`.
- **CI** : `.github/workflows/ci.yml` bloque sur types, lint, tests, build,
  puis rejoue la suite sur MySQL 8 avec le compte applicatif.

## 🧭 État du projet / limites connues

- Les Google Maps sont **désactivées** (composant conservé)
- Les centres rapports et embarcations lisent tRPC ; quelques restes de
  maquette subsistent dans l'ancien écran `Operations.tsx`
- **Supervision prédictive** : API complète mais pas encore d'interface
- Compteurs de limitation de débit en mémoire (à brancher sur Redis si
  plusieurs instances)
- Pas de temps réel poussé (SSE/WebSocket) : rafraîchissement toutes les 30 s
- Voir `TODO.md`, `FUNCTIONAL_MATRIX.md`, `DATABASE.md`, `DEPLOYMENT.md`

## 📄 Licence

MIT
