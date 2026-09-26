import { pool } from "./db";
import { publish } from "./realtime";
import { maybeOpenAlert, SENSOR_COLS } from "./repo";
import { classify, isEscalation } from "./severity";
import type { Alert, Reading, Sensor, Source, Threshold } from "./types";

export class IngestError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export interface IngestResult {
  sensor: Sensor;
  reading: Reading;
  alert: Alert | null;
}

/**
 * The core loop: store reading → classify against thresholds → update sensor state →
 * open an alert on escalation → broadcast to every connected dashboard.
 */
export async function ingestReading(sensorCode: string, value: number, source: Source): Promise<IngestResult> {
  if (!Number.isFinite(value)) throw new IngestError("قيمة القراءة غير صالحة");
  const db = await pool.connect();
  let result: IngestResult;
  try {
    await db.query("BEGIN");
    const found = await db.query(
      `SELECT ${SENSOR_COLS.split(", ").map((c) => "s." + c).join(", ")},
              t.warning, t.danger, t.direction
         FROM sensors s LEFT JOIN thresholds t ON t.sensor_type = s.type
        WHERE s.code = $1 FOR UPDATE OF s`,
      [sensorCode],
    );
    const row = found.rows[0];
    if (!row) throw new IngestError(`الحساس غير معروف: ${sensorCode}`, 404);
    const limits: Pick<Threshold, "warning" | "danger" | "direction"> | undefined = row.direction
      ? { warning: row.warning, danger: row.danger, direction: row.direction }
      : undefined;
    const status = classify(value, limits);

    const reading: Reading = (
      await db.query(
        "INSERT INTO readings (sensor_id, value, status, source) VALUES ($1, $2, $3, $4) RETURNING *",
        [row.id, value, status, source],
      )
    ).rows[0];
    const sensor: Sensor = (
      await db.query(
        `UPDATE sensors SET last_value = $2, last_status = $3, last_source = $4, last_seen_at = $5
          WHERE id = $1 RETURNING ${SENSOR_COLS}`,
        [row.id, value, status, source, reading.created_at],
      )
    ).rows[0];

    let alert: Alert | null = null;
    if (isEscalation(row.last_status, status) && limits) {
      const limit = (status === "danger" ? limits.danger : limits.warning)!;
      alert = await maybeOpenAlert(db, sensor, reading, status, limit);
    }
    await db.query("COMMIT");
    result = { sensor, reading, alert };
  } catch (e) {
    await db.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    db.release();
  }

  await publish({ type: "reading", sensor: result.sensor, reading: result.reading });
  if (result.alert) await publish({ type: "alert", alert: result.alert });
  return result;
}
