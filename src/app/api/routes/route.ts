import { ADIREA_AREAS, ROAD_EDGES } from "@/engine";
import { body, handler } from "@/lib/api";
import { currentRunView, RunError, setRoadClosure, setRouteTargetArea } from "@/lib/scenario/runner";

/** Virtual roads only. { run, edge, closed } toggles a closure; { run, target } picks the route target (null = auto). */
export const POST = handler(async (user, req: Request) => {
  const b = await body(req);
  const run = Number(b.run);
  if (b.edge != null) {
    if (!ROAD_EDGES.some((e) => e.id === b.edge)) throw new RunError("Unknown virtual segment");
    await setRoadClosure(run, String(b.edge), !!b.closed, user);
  } else if ("target" in b) {
    if (b.target != null && !ADIREA_AREAS.some((a) => a.id === b.target)) throw new RunError("Unknown area");
    await setRouteTargetArea(run, (b.target as string) ?? null, user);
  } else throw new RunError("edge or target required");
  return currentRunView();
});
