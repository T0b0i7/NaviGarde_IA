# NaviGarde IA — matrice fonctionnelle

État vérifié le **04/11/2026** par exécution : `pnpm check`, `pnpm lint`
(0 erreur), `pnpm test` (52 tests), `pnpm build`, `pnpm verify:db`
(20 tables, 14 FK, 9 migrations), `/api/health` et `/api/metrics` sur
serveur réel.

Une ligne n'est marquée **Terminé** que si l'interface, l'API, la persistance
et la vérification sont toutes présentes.

| Module | Interface | Backend | Persistant | Vérification | État |
|---|---|---|---|---|---|
| Dashboard | Oui, responsive, graphes, filtres de période | `data.dashboard.metrics` | Oui : KPI, activité, risques, alertes, inspections | Tests d'intégration + serveur réel | Fonctionnel ; graphiques secondaires encore agrégés côté client |
| Inspections | Création, détail, photos, revue humaine | Création, transition, upload, analyse sauvegardée | Oui : inspections, images, findings, historique | **`businessChain.test.ts` étapes 1–5** | Fonctionnel de bout en bout |
| Analyse IA | Résultat et actions de revue | Baseten côté serveur | Oui : score, confiance, findings, fournisseur | Parcours d'analyse simulé en test ; appel réel à exécuter avec `BASETEN_API_KEY` | Intégration prête, parcours externe à valider |
| Alertes | Écran, recherche, actions | CRUD, historique, création auto, alerte marin publique | Oui | Test d'intégration + plafond 6ᵉ alerte publique → 429 | Fonctionnel |
| Rapports | Centre, détail, PDF | Génération, versions, validation, SHA-256 | Oui | **`businessChain.test.ts` étapes 6–9** | Fonctionnel ; `pdfStorageKey` n'est plus exposé |
| Embarcations | Centre et détail | CRUD, champs techniques | Oui | Test d'intégration + FK | Fonctionnel |
| Bulletins | Création, consultation, publication, archivage | CRUD tRPC | Oui, `maritime_bulletins` | Test d'intégration | Fonctionnel ; pièces jointes côté UI à finaliser |
| Utilisateurs | Liste, création, rôles, statut | Mutations admin | Oui | Tests RBAC + auth | Fonctionnel |
| Notifications | Shell, lecture unitaire/globale | Lecture, marquage | Oui | Build + rafraîchissement 30 s | Fonctionnel ; e-mail non configuré |
| Audit | Consultation superviseur/admin | Lecture protégée, écriture à 33 points | Oui, `audit_events` | `businessChain` vérifie `report.validate` | Fonctionnel |
| Paramètres | Écran thème, seuils, préférences | Lecture, sauvegarde admin | Oui, `app_settings` | Build | Fonctionnel côté serveur |
| Supervision prédictive | Absent de la navigation | `predictive.*` : score, zones, météo, positions | Oui | Logique de seuils testée | API présente, **pas d'interface** |

## Données statiques restantes

- `Operations.tsx` conserve des tableaux de démonstration pour les écrans
  historiques Rapports et Embarcations (les centres `ReportsCenter` et
  `VesselsCenter` sont, eux, branchés sur tRPC).
- `InspectionDetail.tsx` conserve une illustration statique pour certaines
  photos.
- Les classes CSS `mock-*` sont des noms hérités de la maquette : ce ne sont
  pas des données fictives.

## Cœur d'exploitation (ajouté le 04/11)

| Domaine | Avant | Maintenant |
|---|---|---|
| Accès base | `root` sans mot de passe | `navigarde_app` sans droits DDL, refus de root au démarrage |
| Migrations | même compte que l'application | `navigarde_migrator` dédié |
| Secrets | `.env` non validé, JWT de 23 caractères | validation au démarrage, secret de 64 caractères, `verify:env` |
| CI | aucune | GitHub Actions : tsc + lint + tests + build + intégration MySQL |
| Tests métier | 0 sur la chaîne produit | 9 étapes de bout en bout (inspection → rapport validé) |
| Limitation de connexion | IP+e-mail seulement (contournable en changeant d'IP) | double portée IP+e-mail **et** e-mail |
| Healthcheck | `{"status":"ok"}` constant | `SELECT 1` réel, 503 si base coupée |
| Erreurs 500 | invisibles | journalisées avec `X-Request-Id` |
| `pdfStorageKey` | exposé par l'API | filtré pour toutes les réponses |
| Intégrité | aucune FK | 14 contraintes en base |

## Priorités restantes

1. Stockage durable (S3/volume) — photos et PDF perdus au redéploiement.
2. Limitation de débit partagée (Redis) si plusieurs instances.
3. Protection CSRF hors iframe d'aperçu.
4. Parcours navigateur automatisé avec les quatre rôles.
5. Brancher `predictive.*` dans l'interface.
