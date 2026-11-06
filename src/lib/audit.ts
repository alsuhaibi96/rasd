/**
 * Spec §1.1 / §2.2 feature inventory, kept in code so the /system page and docs stay in sync.
 * Status vocabulary: Existing and Verified · Existing – Needs Enhancement · Partially Implemented ·
 * Not Implemented · Verification Pending · Proposed / Future.
 */
export type FeatureStatus = "verified" | "enhanced" | "implemented" | "partial" | "pending" | "future";
export interface Feature {
  name: { en: string; ar: string };
  where: string;
  before: string; // state found in the technical audit
  action: "retain" | "enhance" | "complete" | "implement" | "replace" | "defer";
  status: FeatureStatus;
  notes: string;
}

export const FEATURES: Feature[] = [
  { name: { en: "Live monitoring dashboard", ar: "لوحة المراقبة" }, where: "/", before: "Existing and working (generator data)", action: "enhance", status: "enhanced", notes: "Added L1 panel, risk strip, stage toggle, active vs cumulative counters, scenario scope." },
  { name: { en: "L0 alert engine", ar: "محرك التنبيه L0" }, where: "src/lib/severity.ts", before: "Existing: single threshold, escalation-only alerts, 10-min wall-clock dedup", action: "enhance", status: "enhanced", notes: "Reused classifier; transitions now recorded; run-scoped alerts make replays deterministic." },
  { name: { en: "Alert history & acknowledge", ar: "سجل التنبيهات والاطلاع" }, where: "/alerts", before: "Existing and verified", action: "retain", status: "verified", notes: "Ack never deletes; scenario alerts filterable by scenario_id." },
  { name: { en: "Thresholds 60/80 cm", ar: "حدود 60/80 سم" }, where: "/thresholds, db seed", before: "Found in code (seed) and editable", action: "retain", status: "verified", notes: "Reclassified: verified website configuration value — NOT a validated hydrological threshold. Snapshotted per run." },
  { name: { en: "Data source classification", ar: "تصنيف مصدر البيانات" }, where: "readings/alerts.data_source", before: "Only device|simulator", action: "implement", status: "implemented", notes: "real | simulated | test | external; device = external until verified." },
  { name: { en: "Data validation", ar: "التحقق من البيانات" }, where: "src/engine/validate.ts", before: "Only finite-number check", action: "implement", status: "implemented", notes: "Completeness, type, unit, timestamp, duplicate, missing, range, source identity." },
  { name: { en: "Replay engine", ar: "محرك إعادة التشغيل" }, where: "/simulation", before: "Not implemented", action: "implement", status: "implemented", notes: "F-03 scripted + parametric, play/pause/resume/restart/speed, tick clock, deterministic scrubber." },
  { name: { en: "L1 rule-based risk", ar: "تقييم الخطر L1" }, where: "src/engine/l1.ts", before: "Not implemented", action: "implement", status: "implemented", notes: "F-03 rules, warm-up, recession, template explanations (exact Section 7 strings)." },
  { name: { en: "AI risk intelligence", ar: "الذكاء الاصطناعي" }, where: "/system", before: "Not implemented (no model)", action: "defer", status: "future", notes: "Runtime status probe only: Not Configured. Shown disabled and labeled Proposed." },
  { name: { en: "Saudi stations map", ar: "خريطة نقاط الرصد" }, where: "/", before: "Existing (maplibre, local geojson)", action: "retain", status: "verified", notes: "Works offline (no tile server)." },
  { name: { en: "Virtual areas & area risk", ar: "المناطق الافتراضية وخطرها" }, where: "/simulation", before: "Not implemented", action: "implement", status: "implemented", notes: "8 virtual areas, AREA-v0.1 lag/offset association, No Data / Unaffected states." },
  { name: { en: "Area ranking", ar: "ترتيب المناطق" }, where: "/simulation", before: "Not implemented", action: "implement", status: "implemented", notes: "RANK-v0.1 lexicographic with explicit ties." },
  { name: { en: "Decision support", ar: "دعم القرار" }, where: "/simulation", before: "Fixed text on priority alert only", action: "implement", status: "implemented", notes: "Area-linked recommendations, supersede history, review workflow." },
  { name: { en: "Response plan + versions", ar: "خطة الاستجابة وإصداراتها" }, where: "/plans", before: "Not implemented", action: "implement", status: "implemented", notes: "Auto-versioned on condition change, diff with reasons, optimistic locking." },
  { name: { en: "Virtual routes & closures", ar: "المسارات والإغلاقات الافتراضية" }, where: "/simulation", before: "Not implemented", action: "implement", status: "implemented", notes: "Dijkstra on a virtual network; operator closures; no-route state. Not real navigation." },
  { name: { en: "What-if projection", ar: "إسقاط ماذا لو" }, where: "/simulation", before: "Not implemented", action: "implement", status: "implemented", notes: "Flood only, 15/30 min, explicit assumptions, isolated from L0/L1." },
  { name: { en: "Event & audit log", ar: "سجل الأحداث والتدقيق" }, where: "/events", before: "Not implemented", action: "implement", status: "implemented", notes: "Append-only with prev/new/reason/source/area." },
  { name: { en: "Response cycle strip", ar: "شريط دورة الاستجابة" }, where: "dashboard", before: "Static decorative animation (violates §1.2.8)", action: "replace", status: "implemented", notes: "Replaced by the live Operational Chain showing each stage's real runtime status." },
  { name: { en: "Verification Center", ar: "مركز التحقق" }, where: "/verification", before: "Not implemented", action: "implement", status: "implemented", notes: "Runs F-03 TC-01…17 and AT-01…25 against engine + persisted runs." },
  { name: { en: "Offline operation", ar: "العمل دون اتصال" }, where: "—", before: "Verification Pending", action: "complete", status: "pending", notes: "Core is local (fonts self-hosted, local geojson, no external APIs). Claims only from recorded TC-11a/b runs." },
  { name: { en: "Real sensors / real geography / forecasting", ar: "حساسات وجغرافيا حقيقية / تنبؤ" }, where: "—", before: "Not implemented", action: "defer", status: "future", notes: "R4 — outside the current commitment." },
];

export const STACK = [
  ["Frontend", "Next.js 15 App Router, React 19, Tailwind 4, zustand store, Recharts, MapLibre GL (local GeoJSON, no tiles)"],
  ["Backend", "Next.js route handlers (Node), single process; SSE stream fed by pg LISTEN/NOTIFY + in-process emit"],
  ["Database", "PostgreSQL (pg driver, idempotent schema.sql); tables: stations, sensors, readings, alerts, thresholds, scenario_runs, assessments, area_assessments, recommendations, plan_versions, alert_transitions, events, test_records"],
  ["Engine", "src/engine — pure, deterministic, isomorphic TypeScript (server runner, What-if, Verification, unit tests)"],
  ["Auth", "Signed cookie session (jose); all pages and APIs except login/ingest/health require it; ingest uses an API key"],
  ["Deployment", "Standalone build shipped by deploy/deploy.sh to a 2 GB VPS; systemd + nginx + certbot"],
  ["Secrets", "Server .env only (AUTH_SECRET, ADMIN_PASSWORD, INGEST_API_KEY); nothing secret in the client bundle"],
] as const;
