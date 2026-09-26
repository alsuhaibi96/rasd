import type { PoolClient } from "pg";
import { pool } from "./db";
import { publish } from "./realtime";
import { classify, isEscalation, validateLimits } from "./severity";
import type { Alert, Reading, Sensor, Snapshot, Threshold } from "./types";

export const SENSOR_COLS =
  "id, code, station_id, type, unit, last_value, last_status, last_source, last_seen_at";

export function simulatorEnabled() {
  return process.env.SIMULATOR !== "off";
}

export async function getSnapshot(): Promise<Snapshot> {
  const [stations, sensors, thresholds, alerts] = await Promise.all([
    pool.query("SELECT * FROM stations ORDER BY id"),
    pool.query(`SELECT ${SENSOR_COLS} FROM sensors ORDER BY id`),
    pool.query("SELECT * FROM thresholds ORDER BY sensor_type"),
    pool.query("SELECT * FROM alerts ORDER BY created_at DESC LIMIT 200"),
  ]);
  return {
    stations: stations.rows,
    sensors: sensors.rows,
    thresholds: thresholds.rows,
    alerts: alerts.rows,
    simulator: simulatorEnabled(),
    serverTime: new Date().toISOString(),
  };
}

export async function getReadings(sensorId: number, limit = 60): Promise<Reading[]> {
  const { rows } = await pool.query(
    "SELECT * FROM readings WHERE sensor_id = $1 ORDER BY created_at DESC LIMIT $2",
    [sensorId, Math.min(Math.max(limit, 1), 1000)],
  );
  return rows.reverse();
}

/** Opens an alert unless the same level is already open for this sensor in the last 10 minutes. */
export async function maybeOpenAlert(
  db: PoolClient,
  sensor: Sensor,
  reading: Pick<Reading, "id" | "value" | "source">,
  level: "warning" | "danger",
  limit: number,
): Promise<Alert | null> {
  const open = await db.query(
    `SELECT 1 FROM alerts WHERE sensor_id = $1 AND level = $2 AND acknowledged_at IS NULL
       AND created_at > now() - interval '10 minutes' LIMIT 1`,
    [sensor.id, level],
  );
  if (open.rowCount) return null;
  const { rows } = await db.query(
    `INSERT INTO alerts (sensor_id, reading_id, level, value, threshold, source)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [sensor.id, reading.id, level, reading.value, limit, reading.source],
  );
  return rows[0];
}

export async function acknowledgeAlert(id: number, by: string): Promise<Alert | null> {
  const { rows } = await pool.query(
    `UPDATE alerts SET acknowledged_at = now(), acknowledged_by = $2
     WHERE id = $1 AND acknowledged_at IS NULL RETURNING *`,
    [id, by],
  );
  if (!rows[0]) return null;
  await publish({ type: "ack", alert: rows[0] });
  return rows[0];
}

type ThresholdInput = Pick<Threshold, "sensor_type" | "warning" | "danger">;

/** Saves limits, re-classifies every sensor's latest value and raises alerts for any escalation. */
export async function saveThresholds(input: ThresholdInput[]) {
  const db = await pool.connect();
  const newAlerts: Alert[] = [];
  try {
    await db.query("BEGIN");
    for (const t of input) {
      const cur = await db.query("SELECT direction FROM thresholds WHERE sensor_type = $1", [t.sensor_type]);
      if (!cur.rows[0]) throw new Error(`نوع حساس غير معروف: ${t.sensor_type}`);
      const err = validateLimits({ ...t, direction: cur.rows[0].direction });
      if (err) throw new Error(err);
      await db.query(
        "UPDATE thresholds SET warning = $2, danger = $3, updated_at = now() WHERE sensor_type = $1",
        [t.sensor_type, t.warning, t.danger],
      );
    }
    const thresholds: Threshold[] = (await db.query("SELECT * FROM thresholds ORDER BY sensor_type")).rows;
    const byType = new Map(thresholds.map((t) => [t.sensor_type, t]));
    const sensors: Sensor[] = (await db.query(`SELECT ${SENSOR_COLS} FROM sensors ORDER BY id FOR UPDATE`)).rows;
    for (const s of sensors) {
      if (s.last_value == null) continue;
      const t = byType.get(s.type);
      const next = classify(s.last_value, t);
      if (next === s.last_status) continue;
      if (isEscalation(s.last_status, next) && t) {
        const last = await db.query(
          "SELECT id, value, source FROM readings WHERE sensor_id = $1 ORDER BY created_at DESC LIMIT 1",
          [s.id],
        );
        const limit = (next === "danger" ? t.danger : t.warning)!;
        if (last.rows[0]) {
          const a = await maybeOpenAlert(db, s, last.rows[0], next, limit);
          if (a) newAlerts.push(a);
        }
      }
      await db.query("UPDATE sensors SET last_status = $2 WHERE id = $1", [s.id, next]);
      s.last_status = next;
    }
    await db.query("COMMIT");
    await publish({ type: "thresholds", thresholds, sensors });
    for (const alert of newAlerts) await publish({ type: "alert", alert });
    return { thresholds, sensors };
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
  }
}
