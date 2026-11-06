import { ACTION_ORDER, CATALOG } from "./decide";
import { RISK_LABEL } from "./rank";
import type { PlanArea, PlanChange, PlanVersion, RankRow, Recommendation, RouteResult } from "./types";

/** Current plan content from the ranking, active recommendations and route. */
export function buildAreas(ranking: RankRow[], recs: Recommendation[]): PlanArea[] {
  const active = recs.filter((r) => r.active);
  return ranking.map((row) => ({
    area_id: row.area_id,
    risk: row.risk,
    priority: row.rank,
    tie: row.tie,
    actions: active
      .filter((r) => r.area_id === row.area_id)
      .sort((a, b) => ACTION_ORDER.indexOf(a.recommended_action) - ACTION_ORDER.indexOf(b.recommended_action))
      .map((r) => ({ key: `${r.area_id}:${r.recommended_action}`, area_id: r.area_id, action: r.recommended_action, recommendation_id: r.recommendation_id, status: r.status })),
  }));
}

/** PLAN-v0.1 — what changed between two plan contents, each change with its reason. */
export function diffPlans(prev: PlanVersion | undefined, areas: PlanArea[], route: RouteResult | null): PlanChange[] {
  const changes: PlanChange[] = [];
  const before = new Map((prev?.areas ?? []).map((a) => [a.area_id, a]));
  for (const a of areas) {
    const p = before.get(a.area_id);
    const R = RISK_LABEL[a.risk];
    if (!p || p.risk !== a.risk) {
      const from = p ? RISK_LABEL[p.risk] : null;
      changes.push({
        kind: "risk",
        area_id: a.area_id,
        from: p?.risk,
        to: a.risk,
        reason: from ? { en: `Area risk changed ${from.en} → ${R.en}`, ar: `تغيّر خطر المنطقة ${from.ar} ← ${R.ar}` } : { en: `Area added to plan at ${R.en}`, ar: `أُضيفت المنطقة للخطة بمستوى ${R.ar}` },
      });
    }
    if (p && p.priority !== a.priority)
      changes.push({ kind: "priority", area_id: a.area_id, from: p.priority, to: a.priority, reason: { en: `Priority re-ranked #${p.priority} → #${a.priority} (RANK-v0.1)`, ar: `أُعيد ترتيب الأولوية #${p.priority} ← #${a.priority} (RANK-v0.1)` } });
    const prevKeys = new Set((p?.actions ?? []).map((x) => x.key));
    const nowKeys = new Set(a.actions.map((x) => x.key));
    for (const x of a.actions)
      if (!prevKeys.has(x.key))
        changes.push({ kind: "added", area_id: a.area_id, action: x.action, reason: { en: `${CATALOG[x.action].en} proposed: area now ${R.en}`, ar: `اقتُرح «${CATALOG[x.action].ar}»: المنطقة الآن ${R.ar}` } });
    for (const x of p?.actions ?? [])
      if (!nowKeys.has(x.key))
        changes.push({ kind: "withdrawn", area_id: a.area_id, action: x.action, reason: { en: `${CATALOG[x.action].en} no longer suitable: area now ${R.en}`, ar: `«${CATALOG[x.action].ar}» لم يعد مناسبًا: المنطقة الآن ${R.ar}` } });
  }
  const pe = prev?.route ? `${prev.route.target_area_id}|${prev.route.status}|${prev.route.edges.join(",")}` : "";
  const ne = route ? `${route.target_area_id}|${route.status}|${route.edges.join(",")}` : "";
  if (pe !== ne && (prev || route))
    changes.push({
      kind: "route",
      area_id: route?.target_area_id ?? null,
      from: prev?.route?.edges.join("→") || "—",
      to: route ? (route.status === "ok" ? route.edges.join("→") : "no route") : "—",
      reason: route ? route.explanation : { en: "No affected area needs a route", ar: "لا توجد منطقة متأثرة تحتاج مسارًا" },
    });
  return changes;
}

export function planStatus(areas: PlanArea[]): PlanVersion["plan_status"] {
  const reviewable = areas.flatMap((a) => a.actions).filter((x) => x.action !== "monitor");
  if (!reviewable.length) return "draft";
  const approved = reviewable.filter((x) => x.status === "approved").length;
  if (approved === reviewable.length) return "approved";
  if (approved > 0) return "partially_approved";
  if (reviewable.some((x) => x.status === "under_review")) return "under_review";
  return "draft";
}

export function summarize(changes: PlanChange[]): { en: string; ar: string } {
  const c = (k: PlanChange["kind"]) => changes.filter((x) => x.kind === k).length;
  const parts: [number, string, string][] = [
    [c("risk"), "area risk change(s)", "تغيّر خطر منطقة"],
    [c("priority"), "priority change(s)", "تغيّر أولوية"],
    [c("added"), "action(s) proposed", "إجراء مقترح"],
    [c("withdrawn"), "action(s) withdrawn", "إجراء مسحوب"],
    [c("route"), "route change", "تغيّر المسار"],
  ];
  const f = parts.filter((p) => p[0] > 0);
  return { en: f.map((p) => `${p[0]} ${p[1]}`).join(", "), ar: f.map((p) => `${p[0]} ${p[2]}`).join("، ") };
}
