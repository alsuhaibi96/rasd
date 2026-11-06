import { project } from "@/engine";
import { body, handler } from "@/lib/api";
import { activeRunConfig, logWhatIf, RunError } from "@/lib/scenario/runner";

/**
 * What-if Projection – Simulation. Computed from the current state by a pure function, so L0/L1,
 * alerts and the plan stay untouched (spec §13.4). Only the execution itself is logged.
 */
export const POST = handler(async (user, req: Request) => {
  const b = await body(req);
  const a = activeRunConfig();
  if (!a) throw new RunError("Start a flood simulation first — What-if needs a scenario state", 409);
  if (!a.spec.scenario_id.startsWith("FLOOD")) throw new RunError("What-if is approved for flood simulation only", 422);
  const horizon = Number(b.horizon) === 30 ? 30 : 15;
  const rain = ["persist", "taper", "stop"].includes(String(b.rain)) ? (b.rain as "persist") : "persist";
  const damping = Math.min(1, Math.max(0, Number(b.damping ?? 0.85)));
  const result = project(a.state, a.cfg, { horizon, rain, damping });
  if (!result) throw new RunError("No valid current reading to project from", 409);
  await logWhatIf({ horizon, rain, damping, start_tick: result.start_tick, ruleset: result.ruleset }, user);
  return result;
});
