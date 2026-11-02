# TODO NaviGarde IA — données réelles

## Tranche 1 livrée

La migration MySQL/Drizzle a été générée et appliquée. Les tables `vessels`, `inspections`, `inspection_images`, `alerts`, `reports`, `notifications` et `audit_events` existent désormais. La table `users` possède le champ `appRole` pour Agent, Superviseur et Administrateur.

Le routeur tRPC `data` et la couche `server/db.ts` exposent les lectures et mutations persistantes pour embarcations, alertes et notifications. Les procédures sensibles utilisent des permissions serveur : agent authentifié pour créer/lire, superviseur pour modifier les alertes et administrateur pour supprimer les embarcations.

## Tranche 2 à réaliser

- [ ] Brancher `AlertsPage`, `VesselsPage` et le centre de notifications aux procédures tRPC.
- [ ] Brancher `ReportsPage` et `NewInspection` aux tables `reports`, `inspections` et `inspection_images`.
- [ ] Ajouter la création d’événements dans `audit_events` à chaque mutation.
- [ ] Remplacer la session de démonstration locale par l’utilisateur de session serveur dans toutes les vues.
- [ ] Ajouter stockage durable des photos et audios, puis file de synchronisation hors ligne IndexedDB.
- [ ] Alimenter les graphiques avec agrégations MySQL historiques et score de risque dynamique.
