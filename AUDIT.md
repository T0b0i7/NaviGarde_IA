# Audit technique NaviGarde IA

Date : 31 octobre 2026

## 1. Synthèse

NaviGarde IA possède une base technique cohérente et déjà plusieurs écrans de qualité concours : cockpit superviseur, nouvelle inspection, centre d’alertes, centre de rapports, gestion des embarcations, détail d’une inspection et détail d’une embarcation. Le projet compile et les tests existants passent.

La principale limite actuelle est l’écart entre les écrans et la persistance métier. Une partie importante des écrans avancés affiche encore des jeux de données locaux de démonstration. Le socle MySQL/Drizzle et quelques routeurs tRPC existent, mais ils ne sont pas encore utilisés de manière uniforme par les écrans. L’authentification visible dans l’interface repose encore sur trois comptes de démonstration conservés dans `localStorage`, alors que le serveur dispose déjà des primitives de session/OAuth de la plateforme.

Conclusion : il faut conserver le design existant et réaliser une tranche d’industrialisation progressive, en commençant par l’identité/RBAC, puis les inspections et embarcations, ensuite les alertes/rapports/notifications/audit, et enfin la supervision prédictive et les flux temps réel.

## 2. Stack identifiée

- Frontend : React 19, TypeScript 5.9, Vite 7, Wouter, TanStack Query via tRPC, Recharts, Radix UI, Lucide, Sonner.
- Backend : Node.js, Express, tRPC 11, serveur HTTP unique avec Vite en développement et fichiers statiques en production.
- Base de données : MySQL gérée par la plateforme, accès via Drizzle ORM et `mysql2`.
- IA : appels serveur Baseten vers `meta-models/muse-spark-open-1026` pour analyse d’images, génération de rapport, triage vocal et analyse de cockpit.
- Stockage : helpers S3/Manus Storage disponibles, mais les écrans d’inspection utilisent encore principalement des data URLs et une image de démonstration locale.
- Déploiement : Dockerfile Node 22, build `vite build` puis bundle esbuild du serveur, endpoint de santé `/api/health`.
- Diagnostics : TypeScript enregistré et géré par Webdev (`registered: true`, langage `typescript`).

## 3. État vérifié

- 12 pages React.
- 29 fichiers TypeScript côté serveur.
- 11 tables MySQL dans `drizzle/schema.ts`.
- 14 routes déclarées dans `client/public/manus-routes.json`.
- Migrations présentes : utilisateurs, données maritimes persistantes, zones/météo/positions.
- `pnpm check` : réussi.
- `pnpm test` : réussi, 2 fichiers et 6 tests.
- `pnpm build` : réussi. Vite signale seulement l’avertissement existant sur `/api/platform/config.js` sans `type="module"` et un bundle frontend supérieur à 500 kB.
- Git propre après le dernier checkpoint `4f7e277` avant cet audit.

## 4. Fonctionnalités réellement présentes

### Interface

Les écrans suivants sont présents et reliés au routeur : connexion, tableau de bord, nouvelle inspection, détail d’inspection, alertes, rapports, embarcations, détail d’embarcation, bulletins, utilisateurs, audit, paramètres, accès refusé et alerte marin.

Les écrans récents disposent d’actions interactives côté navigateur : filtres, sélection, modales d’ajout/édition/suppression, pagination de démonstration, export CSV de démonstration, impression, partage, changement de thème, notifications, galerie photo et boutons de validation.

### Backend métier déjà disponible

- `data.vessels.list/create/update/remove`.
- `data.alerts.list/create/update/remove`.
- `data.notifications.list/markRead/markAllRead`.
- `predictive.riskScore`.
- `predictive.zones.list/create`.
- `predictive.weather.list/create`.
- `predictive.positions.save` avec détection de franchissement de zone.
- `predictive.triage`.
- `predictive.admin.health`.
- IA d’analyse photo, rapport, voix et indicateurs du dashboard.

## 5. Éléments encore simulés ou incomplets

### Authentification

`client/src/pages/Login.tsx` valide trois comptes codés en dur puis écrit `navigarde_session` dans `localStorage`. Ce flux ne crée pas de session serveur, ne vérifie pas un mot de passe en base et ne protège pas les mutations métier réelles. Le serveur possède en parallèle l’authentification de plateforme/OAuth et `useAuth`, mais le parcours visible concours ne l’utilise pas comme source d’identité principale.

### Données écran

`Home.tsx`, `ReportsCenter.tsx`, `VesselsCenter.tsx`, `VesselDetail.tsx`, `InspectionDetail.tsx` et plusieurs vues de `Operations.tsx` contiennent des tableaux locaux ou des valeurs de maquette. Les routeurs `data` existants ne sont presque pas consommés par les pages : l’audit des appels montre surtout les mutations IA et l’analyse du dashboard.

### Couverture API

Il manque des opérations persistantes complètes pour inspections, images d’inspection, rapports, utilisateurs, bulletins, audit et détail des embarcations. Les tables existent pour plusieurs de ces domaines, mais les procédures de lecture/écriture et les invalidations de cache restent à construire.

### Temps réel et notifications

Le centre de notifications actuel persiste une copie locale via `localStorage`. La table MySQL `notifications` et ses procédures existent, mais le shell ne les utilise pas encore comme source serveur. Il n’existe pas de flux temps réel SSE/WebSocket ; les positions et alertes prédictives sont déclenchées par mutations explicites.

## 6. Risques techniques prioritaires

### P0 — RBAC incohérent

Le frontend utilise les rôles français `Agent de terrain`, `Superviseur`, `Administrateur`. Le schéma et le serveur utilisent `agent`, `supervisor`, `admin`. `dataRouter.ts` vérifie `ctx.user.appRole` contre `admin` et `supervisor`, ce qui doit être harmonisé avec une matrice unique. Les routes visibles côté navigateur ne doivent jamais être considérées comme une protection suffisante.

### P0 — Compte de démonstration utilisé comme authentification

Le flux localStorage est pratique pour une démo, mais ne doit pas être la session de production. Il faut brancher le login sur la session serveur/OAuth de la plateforme ou sur un mécanisme de credentials serveur avec hash, cookie sécurisé, expiration et révocation.

### P0 — IA exposée en procédure publique

`aiRouter.ts` expose l’analyse photo, la génération de rapport, le triage vocal et l’analyse du dashboard en `publicProcedure`. Ces appels doivent être protégés par authentification, permissions, validation de taille, quotas et journalisation afin d’éviter l’abus et les coûts Baseten non contrôlés.

### P1 — Contrôle d’accès des notifications

`markNotificationRead` filtre par identifiant de notification sans vérifier que la notification appartient bien à `userId`. La requête doit inclure les deux conditions avant toute mise à jour.

### P1 — Absence de relations et de contraintes métier

`drizzle/relations.ts` est vide. Les colonnes `vesselId`, `inspectionId`, `createdBy`, `assignedTo`, `userId` et autres références ne sont pas déclarées comme clés étrangères ou relations Drizzle. Les suppressions et lectures liées doivent être sécurisées par contraintes et transactions.

### P1 — Audit non branché aux mutations

La table `auditEvents` existe, mais les mutations CRUD ne créent pas encore systématiquement d’événement d’audit avec utilisateur, entité, action et métadonnées.

### P1 — Base silencieuse en l’absence de connexion

`getDb()` renvoie `null` si `DATABASE_URL` n’est pas disponible ; certaines lectures renvoient alors `[]`, ce qui peut donner à l’interface l’impression qu’il n’y a aucune donnée. En production, l’absence de base doit produire un état technique explicite et observable, pas un tableau vide silencieux.

### P2 — Persistance des fichiers

Les images et audios sont transmis en data URLs aux services IA. Il faut enregistrer les médias dans Manus Storage, stocker leurs clés et URL contrôlées dans `inspectionImages`, puis conserver uniquement des références durables en base.

## 7. Architecture cible à conserver

Le design actuel doit rester la référence visuelle. L’architecture cible est :

1. Shell et pages React existants conservés.
2. Hooks tRPC par domaine avec invalidation après chaque mutation.
3. Routeurs backend protégés par une matrice RBAC partagée.
4. Services DB dédiés par agrégat : utilisateurs, embarcations, inspections, alertes, rapports, bulletins, notifications et audit.
5. Transactions pour les actions composées : inspection + médias + analyse + rapport + audit.
6. Storage pour les médias, MySQL pour les métadonnées et l’historique.
7. IA comme service d’aide explicable, jamais comme autorité finale ; toute décision critique conserve l’acteur humain.
8. Notifications serveur persistantes, puis rafraîchissement contrôlé ou SSE pour les événements critiques.

## 8. Ordre d’implémentation recommandé

### Lot 1 — identité et sécurité

Harmoniser les rôles, protéger toutes les procédures IA et métier, remplacer la décision d’accès localStorage par la session serveur, corriger les cookies Preview, ajouter les contrôles d’appartenance aux ressources et sécuriser les notifications.

### Lot 2 — référentiel embarcations

Brancher `VesselsCenter` et `VesselDetail` sur `data.vessels`, ajouter recherche/filtrage serveur, pagination réelle, création/édition/suppression persistantes, audit de chaque mutation et invalidation tRPC.

### Lot 3 — inspections et médias

Créer les procédures d’inspection et d’images, stocker les médias durablement, persister l’analyse IA, le score, les anomalies et le rapport, puis connecter `NewInspection` et `InspectionDetail`.

### Lot 4 — alertes et notifications

Brancher le centre d’alertes au serveur, affectation, transitions de statut, triage IA, géofencing, notifications ciblées, marquage lu contrôlé et journalisation.

### Lot 5 — rapports, bulletins, utilisateurs et audit

Ajouter les CRUD persistants manquants, validation à double contrôle des rapports, publication des bulletins, gestion des utilisateurs par administrateur et affichage réel du journal d’audit.

### Lot 6 — supervision et exploitation

Connecter météo/positions aux écrans, introduire un rafraîchissement temps réel contrôlé, ajouter observabilité, seed de démonstration séparé, tests d’intégration DB/API, tests RBAC et optimisation du bundle.

## 9. Décision de conservation

À conserver : identité visuelle NaviGarde IA, shell, thèmes, navigation, maquettes, composants UI, intégration IA Baseten côté serveur, schéma MySQL existant, migrations, endpoint de santé, tests de plateforme et routes déclarées.

À corriger : login localStorage, matrice RBAC, procédures publiques IA, notifications locales, absence de relations DB, contrôle d’appartenance des ressources, absence d’audit automatique et données statiques des pages.

À développer : services persistants complets, hooks tRPC côté frontend, médias durables, rapports liés aux inspections, workflow humain, notifications serveur, tests d’intégration et déploiement contrôlé.
