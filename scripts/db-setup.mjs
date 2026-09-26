// Applies db/schema.sql and seeds demo stations, sensors, thresholds and one hour of history.
// Usage: DATABASE_URL=... node scripts/db-setup.mjs [--reset]
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

if (process.argv.includes("--reset")) {
  await db.query("DROP TABLE IF EXISTS alerts, readings, sensors, thresholds, stations CASCADE");
  console.log("dropped existing tables");
}
await db.query(readFileSync(join(root, "db/schema.sql"), "utf8"));
console.log("schema applied");

const THRESHOLDS = [
  // type, warning, danger, direction, min, max
  ["water_level", 60, 80, "above", 0, 200],
  ["smoke_gas", 300, 600, "above", 0, 4095],
  ["temperature", 45, 50, "above", -10, 60],
  ["humidity", 80, 92, "above", 0, 100],
  ["pressure", 1000, 990, "below", 950, 1050],
  ["vibration", 0.3, 0.6, "above", 0, 2],
];

const STATIONS = [
  // code, name, city, region, lat, lng, sensors[[code, type, unit]]
  ["ST-01", "وادي الأديرع", "حائل", "SA-06", 27.52, 41.72, [["WTR-01", "water_level", "cm"]]],
  ["ST-02", "وادي حنيفة", "الرياض", "SA-01", 24.6, 46.66, [["WTR-02", "water_level", "cm"]]],
  ["ST-03", "وادي فاطمة", "مكة المكرمة", "SA-02", 21.43, 39.62, [["WTR-03", "water_level", "cm"]]],
  ["ST-04", "محطة أبها", "عسير", "SA-14", 18.22, 42.51, [["GAS-01", "smoke_gas", "raw"]]],
  ["ST-05", "محطة جدة", "جدة", "SA-02", 21.54, 39.17, [["TMP-01", "temperature", "°C"], ["HUM-01", "humidity", "%"]]],
  ["ST-06", "محطة تبوك", "تبوك", "SA-07", 28.38, 36.57, [["VIB-01", "vibration", "g"]]],
  ["ST-07", "محطة الدمام", "الدمام", "SA-04", 26.43, 50.1, [["PRS-01", "pressure", "hPa"], ["TMP-02", "temperature", "°C"]]],
  ["ST-08", "وادي جازان", "جازان", "SA-09", 16.89, 42.55, [["WTR-04", "water_level", "cm"]]],
  ["ST-09", "غابات رغدان", "الباحة", "SA-11", 20.03, 41.45, [["GAS-02", "smoke_gas", "raw"]]],
  ["ST-10", "حرة لونير", "المدينة المنورة", "SA-03", 25.17, 37.75, [["VIB-02", "vibration", "g"]]],
  ["ST-11", "محطة سكاكا", "الجوف", "SA-12", 29.97, 40.2, [["PRS-02", "pressure", "hPa"]]],
  ["ST-12", "وادي نجران", "نجران", "SA-10", 17.49, 44.13, [["WTR-05", "water_level", "cm"]]],
];

const BASE = { water_level: [24, 1.2], smoke_gas: [170, 12], temperature: [36, 0.35], humidity: [42, 1.2], pressure: [1011, 0.5], vibration: [0.03, 0.01] };

const { rows: existing } = await db.query("SELECT count(*)::int AS n FROM stations");
if (existing[0].n > 0) {
  console.log("already seeded — skipping (use --reset to reseed)");
  await db.end();
  process.exit(0);
}

await db.query("BEGIN");
for (const [type, w, d, dir, min, max] of THRESHOLDS) {
  await db.query(
    "INSERT INTO thresholds (sensor_type, warning, danger, direction, min_value, max_value) VALUES ($1,$2,$3,$4,$5,$6)",
    [type, w, d, dir, min, max],
  );
}
const limits = Object.fromEntries(THRESHOLDS.map(([t, w, d, dir]) => [t, { w, d, dir }]));
const classify = (type, v) => {
  const { w, d, dir } = limits[type];
  const hit = (x) => (dir === "below" ? v <= x : v >= x);
  return hit(d) ? "danger" : hit(w) ? "warning" : "normal";
};

for (const [code, name, city, region, lat, lng, sensors] of STATIONS) {
  const { rows } = await db.query(
    "INSERT INTO stations (code, name_ar, city_ar, region_code, lat, lng) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id",
    [code, name, city, region, lat, lng],
  );
  for (const [scode, type, unit] of sensors) {
    const s = await db.query(
      "INSERT INTO sensors (code, station_id, type, unit) VALUES ($1,$2,$3,$4) RETURNING id",
      [scode, rows[0].id, type, unit],
    );
    // One hour of calm history (one reading per minute) so charts are not empty on first load.
    const [base, noise] = BASE[type];
    let v = base;
    let last;
    for (let i = 60; i >= 1; i--) {
      v = v + (base - v) * 0.2 + (Math.random() - 0.5) * 2 * noise;
      const value = Number(v.toFixed(type === "vibration" ? 3 : 1));
      last = { value, status: classify(type, value), at: new Date(Date.now() - i * 60_000).toISOString() };
      await db.query(
        "INSERT INTO readings (sensor_id, value, status, source, created_at) VALUES ($1,$2,$3,'simulator',$4)",
        [s.rows[0].id, value, last.status, last.at],
      );
    }
    await db.query(
      "UPDATE sensors SET last_value=$2, last_status=$3, last_source='simulator', last_seen_at=$4 WHERE id=$1",
      [s.rows[0].id, last.value, last.status, last.at],
    );
  }
}
await db.query("COMMIT");
console.log(`seeded ${STATIONS.length} stations`);
await db.end();
