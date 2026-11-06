import { body, handler } from "@/lib/api";
import { currentRunView, RunError, startRun } from "@/lib/scenario/runner";

export const dynamic = "force-dynamic";

export const GET = handler(async () => currentRunView());

/** Start a run: { kind: "scripted" | "parametric", params?: {intensity, rate, seed}, speed? } */
export const POST = handler(async (user, req: Request) => {
  const b = await body(req);
  if (b.kind !== "scripted" && b.kind !== "parametric") throw new RunError("kind must be scripted or parametric");
  if (b.hazard && b.hazard !== "flood") throw new RunError("Only the flood hazard is approved for simulation", 422);
  return startRun({ kind: b.kind, params: b.params as never, speed: Number(b.speed) || 1, by: user });
});
