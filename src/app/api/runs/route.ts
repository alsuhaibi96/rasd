import { handler } from "@/lib/api";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const { rows } = await pool.query(
    "SELECT id, scenario_id, kind, segments, engine_version, status, tick, length, speed, started_by, started_at, ended_at, limits FROM scenario_runs ORDER BY id DESC LIMIT 50",
  );
  return rows;
});
