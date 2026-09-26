// MapLibre v6 loads its web worker as a separate ES module; serve it from /vendor/maplibre.
import { copyFileSync, mkdirSync } from "node:fs";

const out = "public/vendor/maplibre";
mkdirSync(out, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(`node_modules/maplibre-gl/dist/${f}`, `${out}/${f}`);
