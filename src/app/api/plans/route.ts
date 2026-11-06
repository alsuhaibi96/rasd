import { handler } from "@/lib/api";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

/** All versions of the run's response plan, oldest first (spec §10.4). */
export const GET = handler(async (_u, req: Request) => {
  const run = Number(new URL(req.url).searchParams.get("run"));
  const { rows } = await pool.query(
    "SELECT plan_id, version, tick, related_event_id, snapshot, changes, change_reason, plan_status, created_at FROM plan_versions WHERE run_id = $1 ORDER BY version",
    [run],
  );
  return rows.map((r) => ({
    plan_id: r.plan_id,
    version: r.version,
    tick: r.tick,
    related_event_id: r.related_event_id,
    areas: r.snapshot.areas,
    route: r.snapshot.route,
    changes: r.changes,
    change_reason: r.change_reason,
    plan_status: r.plan_status,
    created_at: r.created_at,
  }));
});
