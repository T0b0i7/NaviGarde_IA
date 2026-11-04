# NaviGarde IA

Plateforme de sécurité maritime au Bénin : inspection assistée par IA,
alertes terrain, rapports PDF traçables, supervision prédictive.
React 19 / Express / tRPC 11 / Drizzle / MySQL, analyse Baseten.

## Démarrage

```bash
pnpm install
cp .env.example .env        # renseigner DATABASE_URL (compte navigarde_app)
pnpm verify:env             # la configuration est-elle acceptable ?
pnpm db:migrate             # avec MIGRATION_DATABASE_URL
pnpm dev                    # http://localhost:3000/connexion
```

## Commandes

| Commande | Effet |
|---|---|
| `pnpm dev` | Serveur de développement (honore `PORT`, défaut 3000) |
| `pnpm build` / `pnpm start` | Build de production et exécution de `dist/index.js` |
| `pnpm check` | Vérification TypeScript |
| `pnpm lint` | ESLint |
| `pnpm test` | Suite Vitest (62 tests) |
| `pnpm verify:env` | Contrôle de configuration pré-déploiement |
| `pnpm verify:db` | Cycle CRUD réel avec le compte applicatif |
| `pnpm verify:roles` | Parcours navigateur des 4 rôles (64 contrôles, Chrome requis) |
| `pnpm verify:ui` | Balayage des routes, débordements à 1440 px et 390 px |
| `pnpm storage:migrate` | Migre `public/uploads` vers MySQL |

## Sécurité et exploitation

- **Aucun accès `root`** : l'application utilise `navigarde_app`
  (`SELECT/INSERT/UPDATE/DELETE`) et refuse de démarrer sur un
  superutilisateur. Voir `DEPLOYMENT.md`.
- **Stockage durable** : photos et PDF sont écrits **dans MySQL**
  (`storage_objects`), pas sur le disque du conteneur. `STORAGE_DRIVER=local`
  est refusé en production.
- **CSRF** : double soumission (cookie + en-tête `x-csrf-token`) sur toutes
  les mutations authentifiées, puisque la session peut être `SameSite=None`.
- **Secrets jamais dans Git** : `.env`, `identifiants.local.txt` et
  `artifacts/` sont ignorés.
- **Observabilité** : `/api/health` vérifie réellement MySQL (503 si la base
  est coupée) ; `/api/metrics` expose compteurs et latences ; toute réponse
  ≥ 500 est journalisée avec un `X-Request-Id`.
- **CI** : `.github/workflows/ci.yml` bloque sur types, lint, tests et build,
  puis rejoue la suite sur MySQL avec le compte applicatif.
- **Intégrité** : 14 clés étrangères en base depuis la migration `0009`.
- **Performance** : écrans chargés à la demande ; le morceau d'entrée fait
  92 kB (contre 1 124 kB avant), les bibliothèques stables restent en cache.

## Documentation

- `DEPLOYMENT.md` — installation, comptes MySQL, secrets, observabilité, CI.
- `DATABASE.md` — 20 tables, clés étrangères, migrations, RBAC.
- `TODO.md` — ce qui est fait, ce qui reste avant une exposition publique.
- `FUNCTIONAL_MATRIX.md` — état module par module.
- `PRODUCT.md` — positionnement produit et engagements de marque.
- `AUDIT.md`, `SECURITY_AUDIT_PHASE1.md` — audits historiques (contextes
  datés ; relativiser les constats déjà corrigés dans `TODO.md`).
