-- ---------------------------------------------------------------------------
-- Migration 003 — versioning des rapports (EF-35)
--
-- Un rapport validé est immuable : toute modification crée une nouvelle version
-- (`version` + 1) reliée à la précédente par `parent_report_id`.
-- Appliquée automatiquement par `npm run db:init`. Idempotente.
-- ---------------------------------------------------------------------------

BEGIN;

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS parent_report_id UUID
  REFERENCES reports (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reports_parent ON reports (parent_report_id);

-- Plusieurs rapports peuvent être générés depuis la même inspection (refonte) :
-- pas d'index unique (inspection_id, version), le numéro de version est alloué
-- dans une transaction avec verrou sur le rapport parent.
COMMIT;
