# TODO NaviGarde IA — données réelles

## Terminé (03/11/2026)

- [x] Base nettoyée : vessels, inspections, alerts, reports, bulletins, notifications, audit vidés. 3 utilisateurs conservés.
- [x] Fausses données frontend supprimées : VesselsCenter, ReportsCenter, VesselDetail, InspectionDetail, Home, AppShell, Operations, Settings, NewInspection, BulletinsPage.
- [x] Backend complété : vessels.get, inspections.createFull (réutilise immatriculation), inspections.get enrichi (vessel), alerts.get, alerts.createPublic (marin), filtrage vesselId, audit auto sur mutations, stockage local /uploads fallback.
- [x] Design harmonisé : navigarde-premium.css, KPI réels, états vides, chargement, erreurs BD explicites, responsive, print.
- [x] Sync BD vérifiée : scripts/verify-db-sync.ts OK (20 tables, 8 migrations, cycle CRUD complet), tsc OK, vitest 13/13 OK, build vite+esbuild OK.
- [x] Marin /marin/alerte persiste en base via createPublic. Notifications temps réel (30s). Badge alertes dynamique.

## Comptes (identifiants.local.txt)
- admin : thomas.adje@navigarde.bj
- supervisor : adelaide.hounde@navigarde.bj
- agent : koffi.dossa@navigarde.bj

## Démarrage
- MySQL XAMPP actif, base `navigarde` (DATABASE_URL=mysql://root:@localhost:3306/navigarde)
- `pnpm dev` → http://localhost:3000/connexion
- `npx tsx scripts/verify-db-sync.ts` → contrôle sync
- `npx tsx scripts/clean-false-data.ts` → re-nettoyer si besoin (garde users)

## Restant optionnel
- Brancher BASETEN_API_KEY pour IA réelle (sinon message explicite).
- Configurer MANUS_API_URL/KEY en prod (dev utilise /uploads local).
- Ajouter SSE/WebSocket si temps réel poussé requis.
