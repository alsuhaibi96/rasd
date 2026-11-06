import { body, handler } from "@/lib/api";
import { currentRunView, pauseRun, restartRun, resumeRun, RunError, setParams, setSpeed, stopRun } from "@/lib/scenario/runner";

type Ctx = { params: Promise<{ run: string }> };

/** { action: pause | resume | restart | speed | params | stop, speed?, params? } */
export const POST = handler(async (user, req: Request, ctx: Ctx) => {
  const run = Number((await ctx.params).run);
  const b = await body(req);
  switch (b.action) {
    case "pause":
      await pauseRun(run, user);
      break;
    case "resume":
      await resumeRun(run, user);
      break;
    case "restart":
      return restartRun(run, user);
    case "speed":
      await setSpeed(run, Number(b.speed), user);
      break;
    case "params":
      await setParams(run, (b.params ?? {}) as never, user);
      break;
    case "stop":
      await stopRun(user);
      return { ok: true };
    default:
      throw new RunError("Unknown action");
  }
  return currentRunView();
});
