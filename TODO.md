# NaviGarde IA — TODO cœur d'exploitation

Historique des chantiers de mise en production. Les cases cochées sont
**vérifiées par exécution**, pas seulement par relecture du code.

## Fait le 04/11/2026 — deuxième passe

### 10. Stockage durable (MySQL)

Le point le plus risqué pour une démonstration : `/public/uploads` disparaît
avec le conteneur, donc **toutes les photos et tous les PDF** étaient perdus à
chaque redéploiement.

- [x] Table `storage_objects` (`LONGBLOB`, type MIME, taille, SHA-256) —
  migration `0010`.
- [x] `server/storage.ts` : backend MySQL par défaut dès que `DATABASE_URL`
  existe, disque local uniquement sur `STORAGE_DRIVER=local`.
- [x] `STORAGE_DRIVER=local` **refusé en production** : le serveur ne démarre
  pas plutôt que de promettre une durabilité qu'il n'a pas.
- [x] Route `/uploads/*` sert depuis MySQL (`server/uploadRoutes.ts`),
  remplace `express.static`. En-têtes `nosniff`, `Content-Disposition`
  contrôlée, cache immuable, traversée refusée (404 vérifié).
- [x] 18 fichiers historiques migrés, relecture **octet pour octet** vérifiée
  (`pnpm storage:migrate`). 0 référence de base orpheline.
- [x] Vérifié sur serveur réel : JPEG 200 à 105 113 octets, PDF 200 à
  244 514 octets, servis depuis la base.

> Piège rencontré : `storagePut` ajoute un suffixe de hachage à la clé, ce qui
> cassait le lien `inspection_images.storageKey` → fichier. Ajout de
> `storagePutExact` pour la migration.

### 11. Protection CSRF

- [x] Double soumission : cookie `navigarde_csrf` lisible + en-tête
  `x-csrf-token` obligatoire sur toute mutation authentifiée
  (`server/_core/csrf.ts`, `server/_core/context.ts`).
- [x] Comparaison à temps constant, exemptions limitées à la connexion et à
  la réinitialisation de mot de passe.
- [x] Vérifié dans un vrai navigateur : mutation sans jeton → **403**.
- [x] `SESSION_SAMESITE` configurable ; `none` seulement quand c'est
  réellement nécessaire (iframe d'aperçu), `lax` sinon.

### 12. Bundle

- [x] Écrans chargés à la demande (`client/src/App.tsx`) : chaque page est un
  morceau séparé.
- [x] Découpage corrigé : un découpage par bibliothèque provoquait un
  `Cannot read properties of undefined (reading 'exports')` au chargement
  (interop CommonJS entre morceaux). Une seule bibliothèque : `vendor`.
- [x] Chunk principal **1 124 kB → 92 kB**. `vendor` (1 052 kB, 314 kB gzip)
  est stable et reste en cache entre deux déploiements.

### 13. Parcours navigateur des quatre rôles

- [x] `pnpm verify:roles --base <url>` : 64 contrôles sur Admin, Superviseur,
  Agent et Observateur — connexion, navigation autorisée, navigation refusée,
  API directe, CSRF, erreurs console et requêtes en échec.
- [x] **64/64 réussis**, captures dans `artifacts/role-*.png`.
- [x] Deux défauts produits trouvés et corrigés par ce test :
  - `data.inspections.list` exigeait un rôle d'écriture alors que les centres
    Rapports et Embarcations (ouverts à l'Observateur) en ont besoin en
    lecture : la page `/rapports` renvoyait 403 à l'Observateur.
  - Limitation de débit à **300 requêtes/15 min** : une navigation normale
    changeait de page, le dashboard et les notifications se rafraîchissant
    toutes les 30 s. Portée à 600 req/min, désactivée en `NODE_ENV=test`.

---

## Fait le 04/11/2026 — première passe

## Fait le 04/11/2026 — durcissement production

### 1. Base de données : compte dédié

- [x] Compte `navigarde_app` : `SELECT, INSERT, UPDATE, DELETE` seulement.
  `CREATE TABLE`, `DROP DATABASE` et `mysql.user` sont refusés (vérifié).
- [x] Compte `navigarde_migrator` séparé pour les migrations
  (`CREATE, ALTER, DROP, INDEX, REFERENCES`).
- [x] `DATABASE_URL` basculé de `root` vers `navigarde_app`.
- [x] Cycle CRUD complet validé avec les droits réduits
  (`pnpm verify:db` → 20 tables, 14 FK, 9 migrations).
- [x] `scripts/verify-db-sync.ts`, `create-role-accounts.ts`, `seed.ts`,
  `clean-false-data.ts`, `fix-passwords.ts` ne se connectent plus en root en
  dur ; le compte fait planter l'application.
- [x] Tests d'intégration alignés sur le compte applicatif
  (`server/testDb.ts` refuse `root`).

> Incident de découverte : la table système `mysql.db` de MariaDB/XAMPP était
> corrompue ; les `GRANT` échouaient **silencieusement**. Réparée avec
> `REPAIR TABLE mysql.db, mysql.tables_priv;`. À vérifier sur tout nouvel
> environnement XAMPP.

### 2. Secrets

- [x] `assertEnvironment()` valide au démarrage : refus de `root`, d'une URL
  illisible, d'un protocole non MySQL, d'un secret `< 32` caractères.
- [x] `MANUS_JWT_SECRET` de démonstration (23 caractères) remplacé par un
  secret de 64 caractères.
- [x] `.env.example` réécrit : `DATABASE_URL` vide, `MIGRATION_DATABASE_URL`,
  `LOG_LEVEL`, `SLOW_REQUEST_MS`, `METRICS_TOKEN`.
- [x] `pnpm verify:env` : contrôle pré-déploiement sans afficher de secret.
- [x] Procédure de rotation documentée (`DEPLOYMENT.md`).

### 3. CI

- [x] `.github/workflows/ci.yml` : tâche `static` (tsc, eslint, tests, build)
  et tâche `integration` (MySQL 8 + migrations + comptes de rôle).
- [x] Garde-fou dans la CI : `DATABASE_URL` sur `root` fait échouer le job.
- [x] `eslint.config.js` corrigé : le `ignores` mal placé parsait les fichiers
  de test sans les exclure (9 erreurs de parsing). Lint à **0 erreur**.

### 4. Tests métier — la chaîne qui fait la valeur du produit

- [x] `server/businessChain.test.ts` : inspection → analyse → anomalies →
  confirmation → alerte urgente → rapport PDF → version → validation → audit.
- [x] Vérifié par mutation : en retirant le filtre `pdfStorageKey`, 3 tests
  passent au rouge (les tests détectent réellement la régression).
- [x] 29 nouveaux tests : 52 au total, contre 23 avant.
- [x] Nettoyage : les suites ne laissent plus de `PENTEST-*` orphelins
  (17 embarcations résiduelles supprimées de la base locale).

### 5. Limitation de débit

- [x] `MemoryRateLimiter` derrière l'interface `AsyncRateLimiter` (prêt pour
  Redis).
- [x] **Portée double** : IP+e-mail *et* e-mail seul. Avant, changer d'IP
  contournait totalement le verrou.
- [x] Les deux portées sont contrôlées avant le `scrypt`, protégeant
  également le CPU.
- [x] Réponse de réinitialisation identique que le compte existe ou non.

### 6. Observabilité

- [x] `GET /api/health` exécute `SELECT 1` (timeout 3 s) et renvoie **503**
  si la base est injoignable (vérifié avec des identifiants invalides).
- [x] `GET /api/metrics` : compteurs par route, statuts, latence moyenne/max,
  mémoire. Protégé par `METRICS_TOKEN` (401 sans jeton, vérifié).
- [x] Log structuré de toute réponse HTTP ≥ 500, sans corps de requête.
- [x] Avertissement sur requête lente, `X-Request-Id` sur chaque réponse.
- [x] Arrêt propre `SIGTERM`/`SIGINT`, capture des rejets non gérés.

### 7. Fuite `pdfStorageKey`

- [x] `server/serializers.ts` retire les champs internes de **toutes** les
  réponses (`reports.list` et `reports.get`).
- [x] Test unitaire + test d'intégration.

### 8. Clés étrangères

- [x] Migration `drizzle/0009_foreign_keys.sql` : 14 contraintes.
- [x] Vérifié : 0 ligne orpheline avant application ; insertion d'une
  inspection sans embarcation refusée (erreur 1452).
- [x] Stratégie documentée : `CASCADE` sur les dépendances, `SET NULL` sur les
  références optionnelles, `RESTRICT` sur les données structurantes.

### 9. Bug silencieux corrigé

- [x] `server/storage.ts` utilisait `crypto.randomUUID()` **sans import**
  (dépendait du global Node). Import explicite de `node:crypto`.

## Restant avant une exposition publique

- [ ] **Limitation multi-instance** : brancher Redis sur `AsyncRateLimiter`
  (les compteurs vivent encore dans le processus).
- [ ] **Sauvegarde** : procédure de restauration non démontrée. Les fichiers
  étant désormais en base, un `mysqldump` couvre à la fois données et pièces
  jointes — mais ce n'est pas encore testé de bout en bout.
- [ ] **Images distantes** : `images.unsplash.com` figure dans la CSP et une
  image est chargée depuis ce domaine ; une démonstration hors ligne la perd.
- [ ] **CSS** : `index-*.css` reste à 247 kB (47 kB gzip).
- [ ] **Bouton « AI analysis »** visible pour l'Observateur dans le tableau de
  bord alors que les procédures IA lui sont fermées.

## Comptes de test

Liste à jour dans `identifiants.local.txt` (hors dépôt Git) :

| Rôle | E-mail | Mot de passe |
|---|---|---|
| Administrateur | `admin@navigarde.bj` | `Admin12345678!` |
| Superviseur | `superviseur@navigarde.bj` | `Superviseur123!` |
| Agent | `agent@navigarde.bj` | `Agent12345678!` |
| Observateur | `observateur@navigarde.bj` | `Observateur123!` |

> ⚠ Les trois comptes nominatifs (`thomas.adje@`, `adelaide.hounde@`,
> `koffi.dossa@`) ont un `passwordHash` réécrit le 04/11 à 10:44 par
> `fix-passwords.ts` : le mot de passe inscrit dans l'ancien
> `identifiants.local.txt` **ne correspond plus**. Réinitialiser via
> `localAuth.resetPassword` ou mettre à jour le fichier avant une démo.

## Démarrage

```bash
pnpm verify:env                  # configuration acceptable ?
pnpm dev                         # http://localhost:3000/connexion
pnpm verify:db                   # cycle CRUD avec droits réduits
npx vitest run                   # 62 tests
pnpm verify:roles --base http://localhost:3000   # 4 rôles dans Chrome
```

MySQL (XAMPP) doit être démarré ; base `navigarde`, compte `navigarde_app`.

> Le parcours `verify:roles` lance Chrome : il échoue en environnement
> confiné (sandbox) avec `spawn EPERM`, ce n'est pas un défaut du projet.
