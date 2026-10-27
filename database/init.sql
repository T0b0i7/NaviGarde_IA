-- ---------------------------------------------------------------------------
-- NaviGarde IA — schéma de base
-- Exécution : npm run db:init
-- Prérequis : PostgreSQL 13+ (gen_random_uuid() natif, sans extension pgcrypto)
-- Le script est idempotent : il peut être rejoué sans perte de données.
-- ---------------------------------------------------------------------------

BEGIN;

-- ---------------------------------------------------------------------------
-- inspections : une photo analysée, un diagnostic, une décision humaine
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inspections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vessel_name           VARCHAR(120)  NOT NULL,
  vessel_type           VARCHAR(20)   NOT NULL
                          CHECK (vessel_type IN ('pirogue', 'vedette', 'barge', 'ferry')),
  location              VARCHAR(160)  NOT NULL,
  declared_capacity     INTEGER       NOT NULL CHECK (declared_capacity > 0),
  risk_level            VARCHAR(10)
                          CHECK (risk_level IN ('FAIBLE', 'MOYEN', 'ELEVE', 'CRITIQUE')),
  anomalies             JSONB         NOT NULL DEFAULT '[]'::jsonb,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),

  -- Champs issus du diagnostic : sans eux, la fiche d'inspection ne serait pas
  -- exploitable par le superviseur (comptages éditables, EF-14 à EF-17).
  passengers_detected   INTEGER       CHECK (passengers_detected >= 0),
  life_vests_detected   INTEGER       CHECK (life_vests_detected >= 0),
  confidence            NUMERIC(4, 3) CHECK (confidence >= 0 AND confidence <= 1),
  needs_review          BOOLEAN       NOT NULL DEFAULT true,
  recommended_action    VARCHAR(30),
  status                VARCHAR(30)   NOT NULL DEFAULT 'analysee'
                          CHECK (status IN ('brouillon', 'analysee', 'analyse_impossible', 'cloturee')),
  ai_metadata           JSONB         NOT NULL DEFAULT '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- alerts : un message vocal de marin, transcrit et classé
-- inspection_id est nullable : un marin n'est pas rattaché à une inspection.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id   UUID REFERENCES inspections (id) ON DELETE SET NULL,
  transcription   TEXT        NOT NULL,
  classification  VARCHAR(40),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Champs de traitement du poste de contrôle (EF-21 à EF-28).
  urgency         VARCHAR(10)
                    CONSTRAINT alerts_urgency_scale_check
                    CHECK (urgency IN ('FAIBLE', 'MOYEN', 'ELEVE', 'CRITIQUE')),
  language        VARCHAR(10),
  summary         TEXT,
  audio_path      TEXT,
  audio_mime      VARCHAR(40),
  extracted       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  latitude        NUMERIC(9, 6) CHECK (latitude BETWEEN -90 AND 90),
  longitude       NUMERIC(9, 6) CHECK (longitude BETWEEN -180 AND 180),
  status          VARCHAR(20) NOT NULL DEFAULT 'recue'
                    CHECK (status IN ('recue', 'prise_en_charge', 'en_intervention', 'cloturee'))
);

-- ---------------------------------------------------------------------------
-- reports : rapport officiel généré, versionné, empreinté
-- ON DELETE RESTRICT : un rapport validé ne doit jamais disparaître avec
-- l'inspection qu'il documente (traçabilité, section 12).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id     UUID NOT NULL REFERENCES inspections (id) ON DELETE RESTRICT,
  alert_id          UUID REFERENCES alerts (id) ON DELETE SET NULL,
  generated_text    TEXT        NOT NULL,
  cryptographic_hash VARCHAR(64), -- SHA-256 hexadécimal du contenu final
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Cycle de vie du document (EF-31, EF-35).
  report_type       VARCHAR(30) NOT NULL DEFAULT 'inspection'
                      CHECK (report_type IN ('infraction', 'inspection', 'incident')),
  status            VARCHAR(20) NOT NULL DEFAULT 'brouillon'
                      CHECK (status IN ('brouillon', 'soumis', 'valide')),
  version           INTEGER     NOT NULL DEFAULT 1 CHECK (version > 0),
  parent_report_id  UUID REFERENCES reports (id) ON DELETE SET NULL,
  validated_by      VARCHAR(120),
  validated_at      TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- Index : les requêtes du tableau de bord filtrent sur ces colonnes.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_inspections_created_at  ON inspections (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspections_risk_level  ON inspections (risk_level);
CREATE INDEX IF NOT EXISTS idx_inspections_status      ON inspections (status);

CREATE INDEX IF NOT EXISTS idx_alerts_created_at       ON alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_status_urgency   ON alerts (status, urgency);
CREATE INDEX IF NOT EXISTS idx_alerts_inspection       ON alerts (inspection_id);

CREATE INDEX IF NOT EXISTS idx_reports_inspection      ON reports (inspection_id);
CREATE INDEX IF NOT EXISTS idx_reports_alert           ON reports (alert_id);
CREATE INDEX IF NOT EXISTS idx_reports_status          ON reports (status);

COMMIT;
