# NaviGarde IA — matrice fonctionnelle auditée

Audit réalisé sur le code présent dans le checkpoint précédent. Une ligne est considérée comme terminée uniquement si l’interface, l’API, la persistance et la vérification sont toutes présentes.

| Module | Interface | Backend | Persistant | Testé | État réel |
|---|---|---|---|---|---|
| Dashboard | Oui, responsive, graphiques et filtres | Oui, `data.dashboard.metrics` | Oui pour KPI, activité, risques, alertes et inspections | TypeScript/build, pas encore navigateur complet | Partiel : plusieurs graphiques secondaires gardent des valeurs de démonstration |
| Inspections | Création, détail, photos, revue humaine | Oui : création, transition, upload, analyse sauvegardée | Oui : inspections, images, findings, historique | Tests généraux, pas parcours complet | Partiel : le parcours IA réel doit être exécuté avec `BASETEN_API_KEY` |
| Analyse IA | UI de résultat et actions de revue | Oui, Baseten côté serveur | Oui : score, confiance, findings, fournisseur | Appel image réel Baseten réussi le 02/11/2026 avec le modèle `meta-models/muse-spark-open-1026`; parcours métier complet encore à exécuter | Intégration externe confirmée, parcours complet restant |
| Alertes | Écran présent, recherche et actions historiques | Oui, CRUD, historique et création automatique | Oui | Tests API généraux, pas parcours complet | Partiel : `AlertsPage` conserve encore des données locales |
| Rapports | Centre et détail présents | Oui, PDF, versions, validation, SHA-256 | Oui | Build et tests généraux | Partiel : l’ancien écran Operations conserve des lignes locales |
| Embarcations | Centres et détail présents | Oui, CRUD et champs techniques | Oui | Build et tests généraux | Partiel : l’ancien écran Operations conserve un seed local |
| Bulletins | Création, consultation, publication, archivage | Oui, CRUD tRPC | Oui, `maritime_bulletins` | TypeScript/build | Fonctionnel côté module principal, pièces jointes à finaliser côté UI |
| Utilisateurs | Liste, création, rôles, statut | Oui, mutations admin | Oui | Tests auth, pas parcours RBAC navigateur | Fonctionnel côté serveur |
| Notifications | Shell, lecture individuelle/globale | Oui | Oui, `notifications` | Build | Fonctionnel, notification e-mail non configurée |
| Audit | Consultation superviseur/admin | Oui, lecture protégée et événements clés | Oui, `audit_events` | Build | Partiel : toutes les mutations métier ne journalisent pas encore uniformément |
| Paramètres | Écran clair/sombre, seuils et préférences | Oui, sauvegarde admin | Oui, `app_settings` | Build | Fonctionnel côté serveur, initialisation UI à améliorer après chargement |

## Données statiques identifiées

- `Home.tsx` contient encore `demoProblems`, `demoAgentPerformance` et `demoDelays` sans agrégations MySQL correspondantes.
- `Home.tsx` utilise des fallbacks `demoActivity`, `demoRisks`, `demoInspections` et `demoAlerts` lorsque l’API est vide ou indisponible. Ces fallbacks doivent être remplacés par des états vides ou erreur.
- `Operations.tsx` conserve `initialAlerts`, `initialReports`, `initialVessels` et `initialAudit` pour des écrans historiques.
- `InspectionDetail.tsx` conserve des valeurs visuelles statiques pour l’illustration de certaines informations et photos.

## Variables externes

- `DATABASE_URL` : nécessaire à la persistance MySQL.
- `BASETEN_API_KEY` : nécessaire à l’analyse réelle Muse Spark Open 1026.
- Variables Manus OAuth/session/storage : fournies par l’environnement de déploiement.

## Priorités de correction

1. Supprimer les fallbacks silencieux du dashboard et afficher des états vides/erreur explicites.
2. Remplacer les écrans Operations Alertes/Rapports/Embarcations par les hooks tRPC déjà disponibles.
3. Ajouter les agrégations backend des graphiques secondaires.
4. Compléter l’audit automatique sur toutes les mutations sensibles.
5. Exécuter les parcours navigateur avec les quatre rôles et une clé Baseten configurée.
