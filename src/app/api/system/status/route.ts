import { handler } from "@/lib/api";
import { aiStatus } from "@/lib/ai-status";
import { pool } from "@/lib/db";
import { currentRunView } from "@/lib/scenario/runner";
import { generatorPaused } from "@/lib/simulator";

export const dynamic = "force-dynamic";

/** Live capability matrix — every value is computed from runtime state, nothing is a static label. */
export const GET = handler(async () => {
  const run = currentRunView();
  let db: "available" | "error" = "available";
  try {
    await pool.query("SELECT 1");
  } catch {
    db = "error";
  }
  const devices = (await pool.query("SELECT count(*)::int AS n FROM sensors WHERE last_source = 'device' AND last_seen_at > now() - interval '2 minutes'")).rows[0].n;
  return {
    db,
    ai: aiStatus(),
    generator: process.env.SIMULATOR === "off" ? "off" : generatorPaused() ? "paused" : "running",
    run: run ? { id: run.run_id, status: run.status, tick: run.tick, scenario: run.scenario_id } : null,
    real_devices_online: devices,
    server_time: new Date().toISOString(),
  };
});
