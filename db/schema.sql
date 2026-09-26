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
