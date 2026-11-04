# Base de données NaviGarde IA

NaviGarde IA utilise une base **MySQL / MariaDB** via `DATABASE_URL`, connectée
avec **Drizzle ORM** et `mysql2`. Les migrations sont versionnées dans
`drizzle/` puis appliquées avec `pnpm db:migrate`.

## Accès

L'application se connecte avec le compte **`navigarde_app`**
(`SELECT, INSERT, UPDATE, DELETE` uniquement). Les migrations utilisent le
compte séparé **`navigarde_migrator`**. Le compte `root` est refusé au
démarrage. Procédure complète : `DEPLOYMENT.md`, section « Compte MySQL
dédié ».

> Vérification rapide que les droits suffisent : `pnpm verify:db`
> (cycle CRUD complet avec le compte applicatif).

## Tables installées (20)

| Table | Rôle |
|---|---|
| `users` | Comptes, profil, `role` legacy et `appRole` métier |
| `auth_sessions` | Sessions locales : hash de jeton, expiration, `lastSeenAt` |
| `password_reset_tokens` | Jetons de récupération, à usage unique |
| `vessels` | Embarcations : propriétaire, capacité, dimensions, statut, risque |
| `inspections` | Contrôles, résultats IA, revue humaine, statut du workflow |
| `inspection_images` | Clés et adresses des photos stockées |
| `inspection_findings` | Anomalies : niveau, confiance, revue humaine |
| `inspection_history` | Transitions d'état d'une inspection |
| `alerts` | Alertes terrain, marin, IA, météo ou système |
| `alert_history` | État de traitement d'une alerte |
| `reports` | Rapports : contenu, version, hash SHA-256 du PDF |
| `report_versions` | Historique immuable des versions de rapport |
| `notifications` | Notifications par utilisateur, `readAt` |
| `audit_events` | Journal des actions sensibles (IP, agent, métadonnées) |
| `maritime_zones` | Zones géofencées (exclusion, forte houle…) |
| `weather_bulletins` | Conditions météo et validité |
| `vessel_positions` | Positions GPS pour la supervision prédictive |
| `maritime_bulletins` | Bulletins d'information maritime |
| `app_settings` | Paramètres applicatifs (clé/valeur) |
| `storage_objects` | **Fichiers** : photos d'inspection et PDF (`LONGBLOB`, MIME, taille, SHA-256) |
| `__drizzle_migrations` | Suivi des migrations appliquées |

## Stockage des fichiers

Les pieces jointes sont dans la base, décision d'exploitation :

- un conteneur recréé perd son disque ; la base, elle, survit aux
  redéploiements ;
- un seul mécanisme de sauvegarde (`mysqldump`) couvre données et fichiers ;
- aucune dépendance externe (S3, volume monté, NFS) à provisionner.

Il n'existe **aucune contrainte d'intégrité** `storage_objects ↔
inspection_images` : un fichier peut survivre à une inspection archivée, et
un enregistrement peut pointer vers un fichier déjà purgé. Ce compromis est
volontaire : les fichiers sont immuables une fois écrits, et les bornes
(`10 Mo` par image) évitent la saturation de `max_allowed_packet`.

## Intégrité référentielle

Depuis la migration `0009_foreign_keys`, **14 contraintes `FOREIGN KEY`**
garantissent l'intégrité en base, et non plus seulement dans le code :

| Relation | Suppression du parent |
|---|---|
| `inspection_images`, `inspection_findings`, `inspection_history` → `inspections` | `CASCADE` |
| `report_versions` → `reports` | `CASCADE` |
| `alert_history` → `alerts` | `CASCADE` |
| `vessel_positions` → `vessels` | `CASCADE` |
| `auth_sessions`, `password_reset_tokens`, `notifications` → `users` | `CASCADE` |
| `inspection_history`, `alert_history`, `reports` → `users` | `SET NULL` |
| `alerts` → `vessels` | `SET NULL` (alerte sans embarcation valide) |
| `inspections` → `vessels` | `RESTRICT` (jamais de perte silencieuse) |

Conséquence pratique : il n'est plus possible de créer une inspection sans
embarcation existante, ni une notification pour un compte inexistant.

## Migrations

| # | Objet |
|---|---|
| 0000 | Création des utilisateurs |
| 0001–0006 | Modèle maritime, inspections, alertes, rapports, audit |
| 0007–0008 | Corrections de types (`timestamp NULL`, `expiresAt`) |
| 0009 | **Clés étrangères** (14 contraintes) |
| 0010 | **`storage_objects`** : fichiers en base, stockage durable |

```bash
DATABASE_URL=$MIGRATION_DATABASE_URL pnpm db:migrate
```

> MariaDB/XAMPP : si un `GRANT` échoue avec
> `ERROR 1030 ... Aria "Read page with wrong checksum"`, réparer les tables
> système avant tout (`REPAIR TABLE mysql.db, mysql.tables_priv;`).

## API persistante

Le routeur tRPC `data` expose les procédures protegées pour embarcations,
alertes, inspections, rapports, bulletins, notifications, audit et dashboard.
`data.dashboard.metrics` calcule indicateurs, risques, activité et listes
récentes depuis MySQL, avec filtre 24 h / 7 j / 30 j.

Le parcours inspection crée l'embarcation et l'inspection, valide les fichiers
JPG/PNG/WebP de moins de 10 Mo, écrit l'image via `storagePut`, conserve
l'analyse IA et les anomalies dans `inspection_findings`, puis permet de
générer un rapport PDF versionné et haché.

**Champs internes** : `reports.pdfStorageKey` n'est **jamais** renvoyé par
l'API (`server/serializers.ts`). Le PDF n'est servi que par
`GET /api/reports/:id/pdf`, après authentification et contrôle d'appartenance.

## Authentification et RBAC

Mots de passe dérivés avec `scrypt`, sel aléatoire, comparaison à temps
constant. Les sessions ne stockent que le hash d'un jeton aléatoire ; le
cookie `navigarde_session` est HttpOnly, Secure, SameSite=None, 7 jours (30
avec « se souvenir de moi »).

`users.appRole` accepte quatre rôles : `agent`, `supervisor`, `admin`,
`observer`. Le contrôle est appliqué côté serveur par les niveaux de procédure
(`operationalProcedure`, `supervisorProcedure`, `adminAppProcedure`).
L'Observateur est bloqué en écriture par le middleware, pas par l'interface.

## Limites connues

- Certains écrans avancés conservent des tableaux de démonstration côté
  interface et doivent être branchés sur leurs hooks tRPC.
- La suppression physique des objets de stockage n'est pas garantie : la base
  applique une suppression logique (`archivedAt`).
- Les fichiers sont stockés localement (`public/uploads`) en développement :
  non durable dans un conteneur (voir `DEPLOYMENT.md`).
