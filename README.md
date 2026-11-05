# NaviGarde IA 🚢

Cockpit maritime de supervision et d’inspection : embarcations, alertes, inspections, rapports et bulletins, avec des fonctions d’assistance IA et une validation humaine prévue dans les workflows.

> **Statut :** projet en développement. Certaines vues et fonctions peuvent encore utiliser des données de démonstration ; ne pas considérer cette application comme un service de production sans revue, configuration et validation opérationnelle.

- [Code source](https://github.com/T0b0i7/NaviGarde_IA)
- [Site de présentation](https://t0b0i7.github.io/NaviGarde_IA/)

## Fonctionnalités principales

- Inspections et analyse assistées par IA
- Gestion des embarcations, alertes, rapports et bulletins maritimes
- Supervision des risques et notifications
- Authentification locale, rôles applicatifs et protection des mutations côté serveur
- Interface React et API tRPC avec persistance MySQL

Les résultats générés par l’IA sont une aide à l’analyse, pas une décision opérationnelle ou une expertise maritime. Ils doivent être vérifiés par une personne qualifiée.

## Stack

React · TypeScript · Vite · Node.js · Express · tRPC · Drizzle ORM · MySQL · Vitest

## Démarrage local

Prérequis : Node.js et pnpm, ainsi qu’une instance MySQL de développement.

```bash
pnpm install
cp .env.example .env
# Renseigner les variables nécessaires dans .env
pnpm verify:env
pnpm db:migrate
pnpm dev
```

Ne réutilise pas les identifiants de test en production. Pour créer les comptes de test, définis d’abord les variables `NAVIGARDE_TEST_AGENT_PASSWORD`, `NAVIGARDE_TEST_SUPERVISOR_PASSWORD`, `NAVIGARDE_TEST_ADMIN_PASSWORD` et `NAVIGARDE_TEST_OBSERVER_PASSWORD`, puis lance :

```bash
pnpm tsx scripts/create-role-accounts.ts
```

Utilise uniquement une base locale ou dédiée aux tests. Les mots de passe doivent être gardés dans ton environnement local, jamais dans le dépôt ou les journaux.

## Vérifications

```bash
pnpm check
pnpm lint
pnpm test
pnpm build
```

## Limites connues

- Les Google Maps sont désactivées.
- Quelques restes de données de maquette peuvent subsister dans l’ancien écran `Operations.tsx`.
- La supervision prédictive dispose d’une API, mais son interface n’est pas encore complète.
- Les compteurs de limitation de débit sont en mémoire ; un déploiement multi-instance demande un stockage partagé.
- Les mises à jour temps réel utilisent actuellement un rafraîchissement périodique.

Consulte `TODO.md`, `FUNCTIONAL_MATRIX.md`, `DATABASE.md` et `DEPLOYMENT.md` pour les détails techniques et l’état des travaux.

## Licence

MIT — voir [`LICENSE`](./LICENSE).
