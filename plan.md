# NaviGarde IA — plan concours opérationnel

## Objectif
Transformer NaviGarde IA en cockpit maritime inspiré des centres opérationnels américains et japonais : inspection assistée, alerte vocale, supervision des équipes, graphes explicables et décisions traçables.

## Architecture
Le client React fournit le shell, la connexion, les écrans CRUD et le dashboard. Chaque graphe est un panneau contrôlable : réduire pour garder la vue d’ensemble, agrandir pour l’examiner, ou lancer une lecture NaviGarde IA. Le serveur tRPC protège la clé Baseten et expose `analyzeDashboard`, en plus des analyses photo, rapport et voix existantes.

## Thème
`ThemeProvider` est activé avec `switchable`. Le thème est stocké sous `navigarde_theme`, appliqué sur `document.documentElement` et dispose d’une couche sombre cohérente pour les surfaces, textes, bordures, tableaux, modales et paramètres. La topbar affiche l’icône d’action correspondante et confirme le changement par notification.

## RBAC
La matrice partagée `shared/rbac.ts` définit les permissions de l’Agent de terrain, du Superviseur et de l’Administrateur. `AuthGate` vérifie la session de démonstration et bloque les routes non autorisées. `AppShell` filtre les liens de navigation et l’écran `Forbidden` explique le refus. Les droits sont conçus pour être repris par les procédures serveur lors du passage aux comptes persistés.

## Interaction et intelligence
Chaque action principale affiche un retour Sonner de succès ou d’erreur. Les actions destructives demandent une confirmation. Les analyses de graphes transmettent la période et les séries de données au modèle, puis affichent un résumé, les signaux visibles, la sévérité, les actions suggérées et la confiance. Le texte rappelle que l’IA aide à décider et ne remplace pas le superviseur.

## Limites connues
Les données métier et les rôles de la démonstration sont encore des jeux locaux dans le navigateur. La version de production doit les remplacer par des tables Drizzle/MySQL, une session serveur signée, des procédures protégées par rôle et des historiques réels pour éviter toute analyse sur données fictives.
