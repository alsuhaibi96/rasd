import { body, handler } from "@/lib/api";
import { pool } from "@/lib/db";
import { RunError } from "@/lib/scenario/runner";

const IDS = ["TC-11a", "TC-11b", "AT-24"];
const STATUSES = ["pass", "fail", "partial", "blocked", "not_tested", "verification_pending"];

export const GET = handler(async () => (await pool.query("SELECT * FROM test_records ORDER BY id DESC LIMIT 100")).rows);

/** Manual results (offline tests) — recorded by a person, never inferred. */
export const POST = handler(async (user, req: Request) => {
  const b = await body(req);
  if (!IDS.includes(String(b.test_id))) throw new RunError("Only manual tests can be recorded here");
  if (!STATUSES.includes(String(b.status))) throw new RunError("Invalid status");
  const { rows } = await pool.query("INSERT INTO test_records (test_id, status, notes, components, recorded_by) VALUES ($1,$2,$3,$4,$5) RETURNING *", [
    b.test_id,
    b.status,
    String(b.notes ?? "").slice(0, 2000),
    JSON.stringify(b.components ?? {}),
    user,
  ]);
  return rows[0];
});
