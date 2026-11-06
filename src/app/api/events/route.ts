import { handler } from "@/lib/api";
import { pool } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Audit log query: ?run=&type=&area=&source=&limit= (oldest first within the returned window). */
export const GET = handler(async (_u, req: Request) => {
  const q = new URL(req.url).searchParams;
  const where: string[] = [];
  const args: unknown[] = [];
  const add = (col: string, v: unknown) => {
    args.push(v);
    where.push(`${col} = $${args.length}`);
  };
  if (q.get("run")) add("run_id", Number(q.get("run")));
  if (q.get("type")) add("type", q.get("type"));
  if (q.get("area")) add("area_id", q.get("area"));
  if (q.get("source")) add("source", q.get("source"));
  const limit = Math.min(Math.max(Number(q.get("limit")) || 300, 1), 5000);
  args.push(limit);
  const { rows } = await pool.query(
    `SELECT * FROM (SELECT * FROM events ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC LIMIT $${args.length}) e ORDER BY id`,
    args,
  );
  return rows;
});
