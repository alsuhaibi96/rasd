-- RASD schema (idempotent)
CREATE TABLE IF NOT EXISTS stations (
  id          serial PRIMARY KEY,
  code        text UNIQUE NOT NULL,
  name_ar     text NOT NULL,
  city_ar     text NOT NULL,
  region_code text NOT NULL,
  lat         double precision NOT NULL,
  lng         double precision NOT NULL
);

CREATE TABLE IF NOT EXISTS thresholds (
  sensor_type text PRIMARY KEY,
  warning     double precision,
  danger      double precision,
  direction   text NOT NULL DEFAULT 'above' CHECK (direction IN ('above', 'below')),
  min_value   double precision NOT NULL DEFAULT 0,
  max_value   double precision NOT NULL DEFAULT 100,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sensors (
  id           serial PRIMARY KEY,
  code         text UNIQUE NOT NULL,
  station_id   int NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  type         text NOT NULL,
  unit         text NOT NULL,
  last_value   double precision,
  last_status  text NOT NULL DEFAULT 'unknown',
  last_source  text NOT NULL DEFAULT 'simulator',
  last_seen_at timestamptz
);

CREATE TABLE IF NOT EXISTS readings (
  id         bigserial PRIMARY KEY,
  sensor_id  int NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
  value      double precision NOT NULL,
  status     text NOT NULL,
  source     text NOT NULL DEFAULT 'simulator',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS readings_sensor_time_idx ON readings (sensor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS alerts (
  id              serial PRIMARY KEY,
  sensor_id       int NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
  reading_id      bigint REFERENCES readings(id) ON DELETE SET NULL,
  level           text NOT NULL CHECK (level IN ('warning', 'danger')),
  value           double precision NOT NULL,
  threshold       double precision NOT NULL,
  source          text NOT NULL DEFAULT 'simulator',
  created_at      timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  acknowledged_by text
);
CREATE INDEX IF NOT EXISTS alerts_time_idx ON alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS alerts_open_idx ON alerts (sensor_id, level) WHERE acknowledged_at IS NULL;

-- ===== RASD-DEV-001 additions (additive, idempotent) =====
-- Spec §4.3 source classification + §4.1 unified model fields on existing tables.
ALTER TABLE readings ADD COLUMN IF NOT EXISTS data_source text NOT NULL DEFAULT 'simulated' CHECK (data_source IN ('real', 'simulated', 'test', 'external'));
ALTER TABLE readings ADD COLUMN IF NOT EXISTS scenario_id text;
ALTER TABLE readings ADD COLUMN IF NOT EXISTS run_id int;
ALTER TABLE readings ADD COLUMN IF NOT EXISTS tick int;
ALTER TABLE readings ADD COLUMN IF NOT EXISTS quality_status text NOT NULL DEFAULT 'valid';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS data_source text NOT NULL DEFAULT 'simulated';
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS scenario_id text;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS run_id int;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS tick int;
ALTER TABLE sensors ADD COLUMN IF NOT EXISTS last_data_source text NOT NULL DEFAULT 'simulated';
ALTER TABLE sensors ADD COLUMN IF NOT EXISTS last_scenario_id text;
-- Device (ESP32) readings are External until the hardware source is verified.
UPDATE readings SET data_source = 'external' WHERE source = 'device' AND data_source = 'simulated';
UPDATE alerts SET data_source = 'external' WHERE source = 'device' AND data_source = 'simulated';
CREATE INDEX IF NOT EXISTS readings_run_idx ON readings (run_id, tick) WHERE run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS alerts_run_idx ON alerts (run_id) WHERE run_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS scenario_runs (
  id             serial PRIMARY KEY,
  scenario_id    text NOT NULL,
  kind           text NOT NULL CHECK (kind IN ('scripted', 'parametric')),
  segments       jsonb NOT NULL DEFAULT '[]',
  engine_version text NOT NULL,
  ruleset        jsonb NOT NULL,
  limits         jsonb NOT NULL,
  t0             timestamptz NOT NULL,
  status         text NOT NULL CHECK (status IN ('running', 'paused', 'completed', 'stopped', 'interrupted')),
  tick           int NOT NULL DEFAULT -1,
  length         int NOT NULL,
  speed          double precision NOT NULL DEFAULT 1,
  started_by     text NOT NULL,
  started_at     timestamptz NOT NULL DEFAULT now(),
  ended_at       timestamptz,
  final_state    jsonb
);

CREATE TABLE IF NOT EXISTS alert_transitions (
  id          bigserial PRIMARY KEY,
  run_id      int REFERENCES scenario_runs(id) ON DELETE CASCADE,
  sensor_code text NOT NULL,
  tick        int,
  from_status text NOT NULL,
  to_status   text NOT NULL,
  value       double precision,
  data_source text NOT NULL DEFAULT 'simulated',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assessments (
  id                bigserial PRIMARY KEY,
  run_id            int NOT NULL REFERENCES scenario_runs(id) ON DELETE CASCADE,
  scenario_id       text,
  tick              int NOT NULL,
  stage             text NOT NULL DEFAULT 'L1',
  station_code      text NOT NULL,
  risk_level        text,
  indicators        jsonb NOT NULL,
  warmup            boolean NOT NULL,
  receding          boolean NOT NULL,
  quality_status    text NOT NULL,
  rule              text NOT NULL,
  explanation       jsonb NOT NULL,
  recommendation    jsonb NOT NULL,
  ruleset           text NOT NULL,
  input_reading_ids bigint[] NOT NULL DEFAULT '{}',
  data_source       text NOT NULL DEFAULT 'simulated',
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, tick, stage)
);

CREATE TABLE IF NOT EXISTS area_assessments (
  run_id      int NOT NULL REFERENCES scenario_runs(id) ON DELETE CASCADE,
  tick        int NOT NULL,
  area_id     text NOT NULL,
  risk        text NOT NULL,
  affected    boolean NOT NULL,
  rank        int,
  tie         boolean NOT NULL DEFAULT false,
  reason      jsonb NOT NULL,
  indicators  jsonb,
  input_ticks int[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (run_id, tick, area_id)
);

CREATE TABLE IF NOT EXISTS recommendations (
  run_id             int NOT NULL REFERENCES scenario_runs(id) ON DELETE CASCADE,
  recommendation_id  text NOT NULL,
  related_event_id   text NOT NULL,
  scenario_id        text,
  area_id            text NOT NULL,
  risk_level         text NOT NULL,
  recommended_action text NOT NULL,
  priority           int NOT NULL,
  reason             jsonb NOT NULL,
  supporting_data    jsonb NOT NULL,
  status             text NOT NULL,
  active             boolean NOT NULL,
  supersedes_id      text,
  superseded_by      text,
  requires_review    boolean NOT NULL,
  reviewed_by        text,
  created_tick       int NOT NULL,
  updated_tick       int NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, recommendation_id)
);

CREATE TABLE IF NOT EXISTS plan_versions (
  run_id           int NOT NULL REFERENCES scenario_runs(id) ON DELETE CASCADE,
  plan_id          text NOT NULL,
  version          int NOT NULL,
  tick             int NOT NULL,
  related_event_id text NOT NULL,
  snapshot         jsonb NOT NULL,
  changes          jsonb NOT NULL,
  change_reason    jsonb NOT NULL,
  plan_status      text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, plan_id, version)
);

-- Spec §14: event & audit log (append-only).
CREATE TABLE IF NOT EXISTS events (
  id          bigserial PRIMARY KEY,
  run_id      int REFERENCES scenario_runs(id) ON DELETE CASCADE,
  event_id    text,
  seq         int,
  scenario_id text,
  tick        int,
  type        text NOT NULL,
  source      text NOT NULL,
  area_id     text,
  entity_id   text,
  prev        jsonb,
  next        jsonb,
  reason      jsonb,
  data        jsonb,
  data_source text NOT NULL DEFAULT 'simulated',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_run_idx ON events (run_id, seq);
CREATE INDEX IF NOT EXISTS events_time_idx ON events (created_at DESC);

-- Manual test records (offline tests etc. — never auto-claimed).
CREATE TABLE IF NOT EXISTS test_records (
  id          serial PRIMARY KEY,
  test_id     text NOT NULL,
  status      text NOT NULL CHECK (status IN ('pass', 'fail', 'partial', 'blocked', 'not_tested', 'verification_pending')),
  notes       text NOT NULL DEFAULT '',
  components  jsonb NOT NULL DEFAULT '{}',
  recorded_by text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
