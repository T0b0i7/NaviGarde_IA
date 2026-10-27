-- ---------------------------------------------------------------------------
-- Migration 002 — module Audio (copilote vocal maritime)
--
-- Appliquée automatiquement par `npm run db:init`, après `database/init.sql`.
-- Idempotente : peut être rejouée sans effet de bord.
-- ---------------------------------------------------------------------------

BEGIN;

-- 1. L'échelle d'urgence passe à 4 niveaux, alignée sur `inspections.risk_level`.
--    Les valeurs du CDC (INFO / URGENT / DETRESSE) sont converties, pas perdues.
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_urgency_check;
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_urgency_scale_check;

UPDATE alerts
   SET urgency = CASE urgency
                   WHEN 'INFO'      THEN 'FAIBLE'
                   WHEN 'URGENT'    THEN 'ELEVE'
                   WHEN 'DETRESSE'  THEN 'CRITIQUE'
                   WHEN 'DÉTRESSE'  THEN 'CRITIQUE'
                   ELSE urgency
                 END
 WHERE urgency IN ('INFO', 'URGENT', 'DETRESSE', 'DÉTRESSE');

ALTER TABLE alerts
  ADD CONSTRAINT alerts_urgency_scale_check
  CHECK (urgency IN ('FAIBLE', 'MOYEN', 'ELEVE', 'CRITIQUE'));

-- 2. Colonnes nécessaires au module audio et à la réécoute (EF-24, EF-25, EF-28).
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS audio_path TEXT;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS audio_mime VARCHAR(40);
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS extracted  JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS latitude   NUMERIC(9, 6);
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS longitude  NUMERIC(9, 6);

-- 3. Tri du centre d'alertes : urgence puis date (EF-26).
CREATE INDEX IF NOT EXISTS idx_alerts_urgency_created
  ON alerts (urgency, created_at DESC);

COMMIT;
