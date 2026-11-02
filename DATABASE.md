# Base de données NaviGarde IA

NaviGarde IA utilise une base **MySQL gérée** via `DATABASE_URL`, connectée avec **Drizzle ORM** et `mysql2`. Les migrations sont générées dans `drizzle/` puis appliquées avec `pnpm db:migrate`.

## Tables installées

- `users` : comptes authentifiés, profils et rôles.
- `auth_sessions` et `password_reset_tokens` : sessions locales et récupération de compte.
- `vessels` : embarcations, propriétaires, capacité, localisation, statut et score de risque.
- `inspections` : contrôles, commentaires, résultats IA, risques, recommandations, fournisseur et statut.
- `inspection_images` : clés et adresses stables des photos stockées.
- `inspection_findings` : anomalies détaillées, niveau, confiance, recommandation et date d’analyse.
- `alerts` : alertes terrain, marin, IA, météo ou système, affectation et résolution.
- `reports` : brouillons, rapports à valider et rapports validés.
- `notifications` : notifications par utilisateur, lien de destination et `readAt`.
- `audit_events` : historique des actions sensibles.
- `maritime_zones`, `weather_bulletins` et `vessel_positions` : supervision prédictive.

## API persistante

Le routeur tRPC `data` expose des procédures protégées pour les embarcations, alertes, notifications, inspections et dashboard. `data.dashboard.metrics` calcule les indicateurs, risques, activité et listes récentes depuis les enregistrements MySQL, avec filtre 24 heures, 7 jours ou 30 jours.

Le parcours inspection crée l’embarcation et l’inspection, valide les fichiers JPG/PNG/WebP de moins de 10 Mo, transfère les images via `storagePut`, appelle le service IA configuré, puis persiste le résultat et les anomalies dans `inspection_findings`. Les adresses `/manus-storage/...` sont stables ; les URLs signées ne sont pas conservées en base.

## Authentification et RBAC

Les mots de passe sont dérivés avec `scrypt`, un sel aléatoire et une comparaison résistante au timing. Les sessions stockent uniquement le hash d’un jeton aléatoire ; le cookie `navigarde_session` est HttpOnly, Secure, SameSite=None et expire après sept jours.

La table `users.appRole` accepte quatre rôles : `agent`, `supervisor`, `admin` et `observer`, correspondant à Agent d’inspection, Superviseur, Administrateur et Observateur. Les procédures sensibles contrôlent le rôle côté serveur. L’Observateur peut consulter les informations autorisées, mais ne peut pas créer ou modifier les données métier.

La création de comptes et le changement de rôle passent par `localAuth.users` et nécessitent un administrateur. Manus OAuth reste supporté en parallèle par `webdev_app_session`. La récupération de mot de passe crée un jeton limité dans le temps et à usage unique.

## Limites connues

Les centres Rapports, Alertes et Embarcations disposent déjà de procédures persistantes, mais certains tableaux avancés conservent encore des jeux de démonstration côté interface et doivent être entièrement remplacés par leurs hooks tRPC. La suppression physique des objets de stockage n’est pas promise par l’API runtime ; l’application doit utiliser une suppression logique en base.
