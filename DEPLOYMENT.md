# NaviGarde IA — installation, sécurité et déploiement

## Prérequis

- Node.js 22 ou supérieur et `pnpm` 10.18.
- MySQL 8 / MariaDB 10.4 accessible par `DATABASE_URL`.
- Un espace de stockage durable pour les images et PDF (voir « Stockage »).
- Une clé serveur Baseten si l'analyse Muse Spark est activée.

## Installation locale

```bash
pnpm install
cp .env.example .env   # puis renseigner les valeurs
pnpm db:migrate        # avec MIGRATION_DATABASE_URL
pnpm check
pnpm test
pnpm dev
```

L'application écoute sur `PORT` (3000 par défaut).

---

## Compte MySQL dédié

**L'application ne doit jamais se connecter en `root`.** Un superutilisateur
MySQL annule en pratique tout le modèle de permissions du produit : une faille
d'injection, un import de données ou une erreur de script peut détruire ou
exposer l'ensemble de la base.

Le serveur vérifie `DATABASE_URL` **au démarrage** et refuse de démarrer en
production si le compte est `root`, `admin`, `mysql` ou `superuser`
(`server/_core/envValidation.ts`).

### 1. Créer les deux comptes

Trois comptes, trois responsabilités :

| Compte | Usage | Privilèges |
|---|---|---|
| `navigarde_app` | l'application | `SELECT, INSERT, UPDATE, DELETE` sur `navigarde.*` |
| `navigarde_migrator` | `pnpm db:migrate` | les précédents + `CREATE, ALTER, INDEX, REFERENCES, DROP` |
| `root` | administration ponctuelle | jamais utilisé par l'application |

```sql
-- Mot de passe fort, généré puis stocké dans le coffre de secrets.
CREATE USER 'navigarde_app'@'localhost'      IDENTIFIED BY '<secret-app>';
GRANT SELECT, INSERT, UPDATE, DELETE ON `navigarde`.* TO 'navigarde_app'@'localhost';

CREATE USER 'navigarde_migrator'@'localhost' IDENTIFIED BY '<secret-migration>';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, REFERENCES, DROP
  ON `navigarde`.* TO 'navigarde_migrator'@'localhost';

FLUSH PRIVILEGES;
```

Le script de référence est `drizzle/grants.sql` ; il ne contient aucun secret.
Si l'hôte est `127.0.0.1` plutôt que `localhost`, MariaDB distingue les deux
comptes : créer les deux entrées ou forcer `127.0.0.1` côté URL.

> ⚠ **MariaDB/XAMPP** : si `GRANT` échoue avec
> `ERROR 1030 ... Aria "Read page with wrong checksum"`, les tables système
> sont corrompues. Réparer avant tout :
> `mysql -u root -e "REPAIR TABLE mysql.db, mysql.tables_priv;"`.
> Sans cette réparation, les privilèges ne s'appliquent pas silencieusement.

### 2. Bascule de `DATABASE_URL`

```dotenv
DATABASE_URL=mysql://navigarde_app:<secret-encodé>@127.0.0.1:3306/navigarde
MIGRATION_DATABASE_URL=mysql://navigarde_migrator:<secret>@127.0.0.1:3306/navigarde
```

Le mot de passe doit être encodé pour l'URL si l'utiliser contient des
caractères réservés (`@ : / ? %`).

### 3. Vérifier que les droits réduits suffisent

```bash
pnpm check && pnpm test && pnpm build && pnpm start
```

Le démarrage doit journaliser un compte `navigarde_app`, et la connexion /
création d'une inspection doivent fonctionner. Toute opération DDL échoue :
c'est le comportement attendu.

### 4. Rotation du mot de passe

```sql
ALTER USER 'navigarde_app'@'localhost' IDENTIFIED BY '<nouveau-secret>';
```

Puis mettre à jour le coffre et redémarrer l'application. Aucun redéploiement
de code n'est nécessaire.

---

## Secrets

Aucun secret ne va dans Git. `.env`, `identifiants.local.txt` et `artifacts/`
sont exclus par `.gitignore`.

- **Développement** : `.env` local.
- **Production** : variables d'environnement injectées par la plateforme
  (Docker secrets, Vault, AWS Secrets Manager, GitHub Environments).
- **Validation** : `assertEnvironment()` refuse le démarrage si un secret
  requis est absent ou trop court (`MANUS_JWT_SECRET` < 32 caractères).
- **Logs** : aucun secret n'est journalisé ; le résumé d'environnement ne
  contient que des booléens et des noms d'utilisateurs.

Rotation : changer la valeur dans le coffre, redémarrer, vérifier
`/api/health`. Pour `BASETEN_API_KEY`, la rotation est sans impact sur les
sessions.

---

## Stockage des fichiers

Les photos d'inspection et les PDF de rapports sont écrits **dans MySQL**
(table `storage_objects`), pas sur le disque du serveur. Un conteneur recréé
ne conserve pas son système de fichiers : le stockage disque perdait toutes
les pièces jointes à chaque redéploiement.

- Backend MySQL dès que `DATABASE_URL` est présent (mode par défaut).
- `STORAGE_DRIVER=local` force le disque : **refusé en production**, averti
  en développement. Réservé au débogage local.
- Route `/uploads/<clé>` : lue depuis la base, en-têtes `nosniff`, type MIME
  figé, `Content-Disposition` contrôlée, traversée de chemin refusée.
- Migration des fichiers historiques :
  `pnpm storage:migrate` (relecture octet pour octet vérifiée).
- Sauvegarde : un `mysqldump` de la base inclut désormais données **et**
  fichiers. Pour des volumes importants, prévoir `max_allowed_packet` côté
  MySQL (les images sont limitées à 10 Mo avant écriture).

---

## Protection CSRF

Le cookie de session peut être `SameSite=None` (iframe d'aperçu cross-site).
Dans ce cas un site tiers peut déclencher une requête authentifiée, donc une
protection dédiée est en place :

- cookie `navigarde_csrf` (lisible par le client) + en-tête `x-csrf-token`
  exigé sur toute mutation authentifiée ;
- exemptions limitées à `localAuth.login` et à la réinitialisation de mot de
  passe ;
- `SESSION_SAMESITE` permet de choisir `lax` (recommandé hors iframe),
  `strict` ou `none`.

---

## Observations

- `GET /api/health` — vérifie **réellement** MySQL (`SELECT 1`, timeout 3 s).
  Renvoie `503` si la base est injoignable : un conteneur cassé n'est plus
  déclaré sain.
- `GET /api/metrics` — compteurs par route, codes HTTP, durée moyenne/max et
  mémoire. Protégé par `METRICS_TOKEN` en production, ouvert en développement.
- Toute réponse HTTP ≥ 500 est journalisée (pino) avec route, durée et
  `X-Request-Id`, sans corps de requête.
- Les requêtes dépassant `SLOW_REQUEST_MS` produisent un avertissement.
- Arrêt propre sur `SIGTERM`/`SIGINT` (10 s de grâce), suivi du code de sortie.

---

## CI

`.github/workflows/ci.yml` exécute deux tâches bloquantes :

1. **static** — `tsc`, `eslint`, tests unitaires (sans base), build.
2. **integration** — MySQL 8 en service, migrations avec le compte de
   migration, création des comptes de test, puis la suite complète avec
   `DATABASE_URL` pointant sur `navigarde_app`. Une garde refuse explicitement
   `root`.

Une branche ne peut donc plus être fusionnée avec des types cassés, un build
cassé, ou une chaîne inspection → rapport en régression.

---

## Tests

```bash
pnpm test                       # suite complète
pnpm vitest run server/businessChain.test.ts   # chaîne métier seule
```

Les suites d'intégration **s'ignorent** si `DATABASE_URL` est absent, au lieu
de fabriquer une connexion privilégiée. `server/testDb.ts` refuse par ailleurs
le compte `root`.

Couverture métier verrouillée par `businessChain.test.ts` :

1. inspection créée et rattachée à l'agent ;
2. analyse IA persistée (score, confiance, anomalies) ;
3. niveau de risque dérivé du score ;
4. confirmation d'anomalie → alerte urgente ;
5. un agent ne peut pas confirmer sa propre anomalie ;
6. rapport PDF versionné et haché ;
7. la clé de stockage n'est jamais exposée par l'API ;
8. chaque modification incrémente la version ;
9. seul un superviseur valide, avec trace d'audit.

Parcours navigateur (`pnpm verify:roles`) : 64 contrôles sur les quatre rôles
— connexion, navigation autorisée et refusée, appels API directs, refus des
mutations sans jeton CSRF, absence d'erreur console. Les captures sont
écrites dans `artifacts/role-*.png`.

---

## Sécurité implémentée

- Validation des entrées par Zod sur toutes les procédures tRPC.
- Requêtes SQL paramétrées par Drizzle/MySQL2.
- Sessions HTTP-only, `SameSite` configurable (`none` par défaut seulement
  quand c'est nécessaire), jeton haché en base.
- Mots de passe `scrypt` avec sel aléatoire et comparaison à temps constant.
- Limitation de connexion à **deux portées** : par IP+e-mail (attaque ciblée)
  et par e-mail seul (attaque distribuée changeant d'IP).
- Protection CSRF par double soumission sur toutes les mutations authentifiées.
- RBAC appliqué côté serveur : Observateur < Agent < Superviseur < Admin.
  Les lectures nécessaires aux centres accessibles à l'Observateur sont
  ouvertes ; les écritures restent fermées.
- Contraintes de clés étrangères en base (migration `0009_foreign_keys`),
  avec `CASCADE` sur les dépendances et `SET NULL` sur les références
  optionnelles.
- Clés de stockage jamais sérialisées vers le client (`server/serializers.ts`).
- En-têtes de sécurité Helmet, rate limiting global (600 req/min) et dédié aux
  PDF.

### Points encore ouverts avant une exposition publique

- **Compteurs en mémoire** : la limitation de débit protège un processus
  unique. Pour plusieurs réplicas, brancher Redis (`MemoryRateLimiter` est
  derrière l'interface `AsyncRateLimiter` pour cela).
- **Sauvegarde** : la restauration n'a pas été testée de bout en bout. La base
  contient désormais les fichiers, donc un `mysqldump` suffit en théorie.
- **Images distantes** : `images.unsplash.com` est autorisé par la CSP ; une
  démonstration hors ligne perd cette image.

---

## Déploiement

```bash
pnpm install --frozen-lockfile
pnpm db:migrate      # avec MIGRATION_DATABASE_URL
pnpm storage:migrate # si des fichiers existent encore sur disque
pnpm build
pnpm start           # avec DATABASE_URL = navigarde_app
```

Après déploiement, vérifier : `/api/health` à `200`, connexion des quatre
rôles, upload d'une image, génération d'un PDF, réception d'une notification et
application des migrations (`SELECT COUNT(*) FROM __drizzle_migrations;`).
Contrôler aussi que le journal annonce `Storage durable (MySQL)`.
