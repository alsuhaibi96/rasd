// Builds public/geo/*.geojson from geoBoundaries (SAU ADM1) + Natural Earth 50m countries.
// Usage: node scripts/build-geo.mjs <ksa-adm1.geojson> <ne_50m_countries.geojson>
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const [ksaSrc, worldSrc] = process.argv.slice(2);
const AR = {
  "SA-01": "منطقة الرياض", "SA-02": "منطقة مكة المكرمة", "SA-03": "منطقة المدينة المنورة",
  "SA-04": "المنطقة الشرقية", "SA-05": "منطقة القصيم", "SA-06": "منطقة حائل", "SA-07": "منطقة تبوك",
  "SA-08": "منطقة الحدود الشمالية", "SA-09": "منطقة جازان", "SA-10": "منطقة نجران",
  "SA-11": "منطقة الباحة", "SA-12": "منطقة الجوف", "SA-14": "منطقة عسير",
};
const ksa = JSON.parse(readFileSync(ksaSrc, "utf8"));
ksa.features = ksa.features.map((f) => ({
  type: "Feature",
  properties: { code: f.properties.shapeISO, name_ar: AR[f.properties.shapeISO], name_en: f.properties.shapeName },
  geometry: f.geometry,
}));
delete ksa.crs;
writeFileSync("/tmp/rasd-ksa.json", JSON.stringify(ksa));

const world = JSON.parse(readFileSync(worldSrc, "utf8"));
world.features = world.features
  .filter((f) => f.properties.ADM0_A3 !== "SAU")
  .map((f) => ({ type: "Feature", properties: { name_ar: f.properties.NAME_AR, iso: f.properties.ADM0_A3 }, geometry: f.geometry }));
writeFileSync("/tmp/rasd-world.json", JSON.stringify(world));

const ms = "node_modules/.bin/mapshaper";
execFileSync(ms, ["/tmp/rasd-ksa.json", "-simplify", "20%", "keep-shapes", "-o", "precision=0.0001", "public/geo/ksa-regions.geojson"], { stdio: "inherit" });
execFileSync(ms, ["public/geo/ksa-regions.geojson", "-dissolve", "-o", "precision=0.0001", "public/geo/ksa-outline.geojson"], { stdio: "inherit" });
execFileSync(ms, ["/tmp/rasd-world.json", "-clip", "bbox=24,5,66,40", "-filter-slivers", "-simplify", "40%", "-o", "precision=0.001", "public/geo/neighbors.geojson"], { stdio: "inherit" });
