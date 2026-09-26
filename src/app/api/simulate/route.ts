import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { IngestError, ingestReading } from "@/lib/ingest";
import { forceSurge, PROFILES } from "@/lib/simulator";
import type { Sensor, Threshold } from "@/lib/types";

type Level = "normal" | "warning" | "danger";

function valueFor(level: Level, s: Sensor, t: Threshold | undefined): number {
  const p = PROFILES[s.type];
  if (!t || t.warning == null || t.danger == null || level === "normal") return p.base + (Math.random() - 0.5) * p.noise * 4;
  const sign = t.direction === "below" ? -1 : 1;
  const span = Math.abs(t.danger - t.warning);
  if (level === "warning") return t.warning + sign * span * (0.2 + Math.random() * 0.6);
  return t.danger + sign * span * (0.1 + Math.random() * 0.6);
}

/** Body: { sensor?: code, level?: normal|warning|danger, value?: number }. Missing sensor → random one. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { sensor?: string; level?: Level; value?: number };
  const { rows: sensors } = await pool.query<Sensor>("SELECT * FROM sensors ORDER BY id");
  const sensor = body.sensor ? sensors.find((s) => s.code === body.sensor) : sensors[Math.floor(Math.random() * sensors.length)];
  if (!sensor) return NextResponse.json({ error: "الحساس غير معروف" }, { status: 404 });
  const { rows } = await pool.query<Threshold>("SELECT * FROM thresholds WHERE sensor_type = $1", [sensor.type]);
  const level: Level = body.level ?? (["normal", "warning", "danger"] as const)[Math.floor(Math.random() * 3)];
  const raw = body.value != null && body.value !== ("" as unknown) ? Number(body.value) : valueFor(level, sensor, rows[0]);
  const value = Number(raw.toFixed(sensor.type === "vibration" ? 3 : 1));
  try {
    const r = await ingestReading(sensor.code, value, "simulator");
    forceSurge(sensor.id, sensor.type, value); // keep the simulator near this level for a while
    return NextResponse.json({ sensor: sensor.code, value, status: r.reading.status, alert: r.alert });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: e instanceof IngestError ? e.status : 500 });
  }
}
