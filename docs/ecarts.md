# Écarts assumés par rapport au cahier des charges

## E-01 · Échelle d'urgence des alertes

- **CDC (EF-23, §8.3)** : `INFO | URGENT | DETRESSE`.
- **Implémenté** : `FAIBLE | MOYEN | ELEVE | CRITIQUE` (exigence du module Audio du 26/10).
- **Raison** : échelle unique partagée avec `inspections.risk_level`, ce qui simplifie
  le tri du centre d'alertes et les filtres du tableau de bord.
- **Compatibilité** : la migration `002_alert_audio.sql` convertit les valeurs existantes
  (`INFO→FAIBLE`, `URGENT→ELEVE`, `DETRESSE→CRITIQUE`) ; `aiClient` accepte encore les
  anciennes valeurs en sortie de modèle et les normalise.
- **Garde-fou conservé** : un signal vital explicite dans la transcription
  (coul, naufrage, homme à la mer, noyade, chaviré) force `CRITIQUE` ; aucune alerte
  `CRITIQUE` ne peut être rétrogradée par le système, seul un superviseur le peut.

## E-02 · Taille maximale d'un message vocal

- **CDC (EF-20)** : 5 Mo, 2 minutes.
- **Implémenté** : 15 Mo (`MAX_AUDIO_MB`), pour absorber les enregistrements longs des
  navigateurs mobiles. À ramener à 5 Mo si la démo le permet.
