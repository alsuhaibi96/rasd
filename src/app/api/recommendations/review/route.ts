import { body, handler } from "@/lib/api";
import { currentRunView, reviewRecommendation, RunError } from "@/lib/scenario/runner";

const STATUSES = ["proposed", "under_review", "approved", "rejected"];

/** { run, recommendation_id, status, plan_version } — 409 if the plan moved on (spec §17.10). */
export const POST = handler(async (user, req: Request) => {
  const b = await body(req);
  if (!STATUSES.includes(String(b.status))) throw new RunError("Invalid status");
  await reviewRecommendation(Number(b.run), String(b.recommendation_id), b.status as never, user, b.plan_version == null ? undefined : Number(b.plan_version));
  return currentRunView();
});
