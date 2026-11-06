"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import type { ExpressionSpecification, GeoJSONSource, MapLayerMouseEvent, StyleSpecification } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { ADIREA_AREAS, BASIN, centroid, ROAD_EDGES, ROAD_NODES, type EngineState, type WhatIfResult } from "@/engine";
import type { Lang } from "@/lib/i18n";
import { RISK_COLOR } from "../ui";

maplibregl.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");

export type LayerKey = "sensors" | "sensorStatus" | "alerts" | "riskZones" | "affected" | "areaRisk" | "priorities" | "routes" | "closures" | "whatif";
export const LAYER_KEYS: LayerKey[] = ["sensors", "sensorStatus", "alerts", "riskZones", "affected", "areaRisk", "priorities", "routes", "closures", "whatif"];

const riskColor: ExpressionSpecification = [
  "match",
  ["get", "risk"],
  "low", RISK_COLOR.low,
  "moderate", RISK_COLOR.moderate,
  "elevated", RISK_COLOR.elevated,
  "severe", RISK_COLOR.severe,
  "no_data", RISK_COLOR.no_data,
  "#1f3237",
];
const nodeById = new Map(ROAD_NODES.map((n) => [n.id, n]));
const L0C: Record<string, string> = { normal: "#34d399", warning: "#fbbf24", danger: "#f43f5e", unknown: "#7b8d91" };

const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    areas: { type: "geojson", data: { type: "FeatureCollection", features: [] }, promoteId: "id" },
    ghost: { type: "geojson", data: { type: "FeatureCollection", features: [] } },
    channel: { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: BASIN.channel } } },
    roads: { type: "geojson", data: { type: "FeatureCollection", features: [] }, promoteId: "id" },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#08161b" } },
    { id: "zone", type: "line", source: "channel", paint: { "line-color": "#34d399", "line-width": 46, "line-blur": 30, "line-opacity": 0 } },
    { id: "channel", type: "line", source: "channel", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#1d4e5f", "line-width": 6, "line-opacity": 0.9 } },
    { id: "area-fill", type: "fill", source: "areas", paint: { "fill-color": riskColor, "fill-opacity": ["case", ["==", ["get", "risk"], "unaffected"], 0.25, 0.32] } },
    { id: "area-line", type: "line", source: "areas", paint: { "line-color": "#2c4a50", "line-width": 1, "line-dasharray": [2, 2] } },
    { id: "affected-line", type: "line", source: "areas", filter: ["==", ["get", "affected"], true], paint: { "line-color": "#e6f0ee", "line-width": 2.5 } },
    { id: "selected-line", type: "line", source: "areas", filter: ["==", ["get", "selected"], true], paint: { "line-color": "#34d399", "line-width": 3 } },
    { id: "ghost-fill", type: "fill", source: "ghost", paint: { "fill-color": riskColor, "fill-opacity": 0.18 } },
    { id: "ghost-hatch", type: "fill", source: "ghost", paint: { "fill-pattern": "hatch" } },
    { id: "ghost-line", type: "line", source: "ghost", paint: { "line-color": riskColor, "line-width": 2, "line-dasharray": [1, 1.5] } },
    { id: "roads", type: "line", source: "roads", layout: { "line-cap": "round" }, paint: { "line-color": ["case", ["get", "atRisk"], "#b45309", "#3a565c"], "line-width": 3 } },
    { id: "roads-hit", type: "line", source: "roads", paint: { "line-color": "#000", "line-width": 14, "line-opacity": 0.01 } },
    { id: "prev-route", type: "line", source: "roads", filter: ["==", ["get", "onPrev"], true], paint: { "line-color": "#8ea4a0", "line-width": 3, "line-dasharray": [1, 2] } },
    { id: "route", type: "line", source: "roads", filter: ["==", ["get", "onRoute"], true], layout: { "line-cap": "round" }, paint: { "line-color": "#34d399", "line-width": 5, "line-opacity": 0.9 } },
    { id: "closed", type: "line", source: "roads", filter: ["==", ["get", "closed"], true], paint: { "line-color": "#f43f5e", "line-width": 4, "line-dasharray": [1, 1] } },
  ],
};

const LAYERS_OF: Record<LayerKey, string[]> = {
  sensors: [],
  sensorStatus: [],
  alerts: [],
  riskZones: ["zone"],
  affected: ["affected-line"],
  areaRisk: ["area-fill"],
  priorities: [],
  routes: ["roads", "prev-route", "route"],
  closures: ["closed"],
  whatif: ["ghost-fill", "ghost-hatch", "ghost-line"],
};

function hatchImage(): ImageData {
  const size = 10;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const on = (x + y) % size < 2;
      const i = (y * size + x) * 4;
      data.set(on ? [230, 240, 238, 150] : [0, 0, 0, 0], i);
    }
  return new ImageData(data, size, size);
}

function el(cls: string, html = "") {
  const d = document.createElement("div");
  d.className = cls;
  d.innerHTML = html;
  return d;
}

interface Props {
  state: EngineState | null;
  layers: Record<LayerKey, boolean>;
  selectedArea: string | null;
  onSelectArea: (id: string | null) => void;
  onToggleRoad?: (edgeId: string) => void;
  whatif: WhatIfResult | null;
  whatifOffset: number;
  lang: Lang;
  className?: string;
}

export default function BasinMap({ state, layers, selectedArea, onSelectArea, onToggleRoad, whatif, whatifOffset, lang, className }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const labels = useRef(new Map<string, { m: maplibregl.Marker; el: HTMLElement }>());
  const sensorMarker = useRef<{ m: maplibregl.Marker; el: HTMLElement } | null>(null);
  const cb = useRef({ onSelectArea, onToggleRoad });
  cb.current = { onSelectArea, onToggleRoad };

  useEffect(() => {
    if (!box.current) return;
    const xs = ROAD_NODES.map((n) => n.lng);
    const ys = ROAD_NODES.map((n) => n.lat);
    const map = new maplibregl.Map({
      container: box.current,
      style: STYLE,
      bounds: [[Math.min(...xs) - 0.012, Math.min(...ys) - 0.012], [Math.max(...xs) + 0.012, Math.max(...ys) + 0.012]],
      fitBoundsOptions: { padding: 30 },
      minZoom: 10,
      maxZoom: 16,
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: false,
      renderWorldCopies: false,
    });
    map.touchZoomRotate.disableRotation();
    mapRef.current = map;
    map.on("load", () => {
      if (!map.hasImage("hatch")) map.addImage("hatch", hatchImage());
      setReady(true);
    });
    map.on("click", "area-fill", (e: MapLayerMouseEvent) => cb.current.onSelectArea((e.features?.[0]?.properties?.id as string) ?? null));
    map.on("click", "roads-hit", (e: MapLayerMouseEvent) => {
      const id = e.features?.[0]?.properties?.id as string | undefined;
      if (id && cb.current.onToggleRoad) cb.current.onToggleRoad(id);
    });
    for (const l of ["area-fill", "roads-hit"]) {
      map.on("mouseenter", l, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", l, () => (map.getCanvas().style.cursor = ""));
    }
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(box.current);
    const labelMap = labels.current;
    return () => {
      ro.disconnect();
      labelMap.clear();
      sensorMarker.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Data → sources.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const areaBy = new Map((state?.areas ?? []).map((a) => [a.area_id, a]));
    const rankBy = new Map((state?.ranking ?? []).map((r) => [r.area_id, r]));
    (map.getSource("areas") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: ADIREA_AREAS.map((a) => ({
        type: "Feature",
        id: a.id,
        properties: { id: a.id, risk: areaBy.get(a.id)?.risk ?? "no_data", affected: !!areaBy.get(a.id)?.affected, selected: a.id === selectedArea },
        geometry: { type: "Polygon", coordinates: [a.polygon] },
      })),
    });
    const closed = new Set(state?.closures ?? []);
    const route = new Set(state?.route?.status === "ok" ? state.route.edges : []);
    const prev = new Set(state?.route?.previous_edges ?? []);
    (map.getSource("roads") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: ROAD_EDGES.map((e) => {
        const ar = e.area_id ? areaBy.get(e.area_id) : undefined;
        return {
          type: "Feature",
          id: e.id,
          properties: { id: e.id, closed: closed.has(e.id), onRoute: route.has(e.id), onPrev: prev.has(e.id) && !route.has(e.id), atRisk: !!ar && (ar.risk === "elevated" || ar.risk === "severe") },
          geometry: { type: "LineString", coordinates: [[nodeById.get(e.a)!.lng, nodeById.get(e.a)!.lat], [nodeById.get(e.b)!.lng, nodeById.get(e.b)!.lat]] },
        };
      }),
    });
    const tick = whatif?.ticks[whatifOffset - 1];
    (map.getSource("ghost") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: tick
        ? ADIREA_AREAS.filter((a) => tick.areas[a.id] !== "unaffected").map((a) => ({ type: "Feature", properties: { id: a.id, risk: tick.areas[a.id] }, geometry: { type: "Polygon", coordinates: [a.polygon] } }))
        : [],
    });
    // Point-level L1 drives the risk-zone glow along the channel.
    const r = state?.l1?.risk_level;
    map.setPaintProperty("zone", "line-color", r ? RISK_COLOR[r] : "#34d399");
    map.setPaintProperty("zone", "line-opacity", r && r !== "low" ? 0.35 : 0.08);

    // Area labels + priority badges (HTML markers: no glyph server needed → works offline).
    for (const a of ADIREA_AREAS) {
      let item = labels.current.get(a.id);
      if (!item) {
        const node = el("sim-area-label");
        node.addEventListener("click", () => cb.current.onSelectArea(a.id));
        item = { el: node, m: new maplibregl.Marker({ element: node }).setLngLat(centroid(a.polygon)).addTo(map) };
        labels.current.set(a.id, item);
      }
      const ar = areaBy.get(a.id);
      const rk = rankBy.get(a.id);
      const showRank = layers.priorities && rk && ar && ar.risk !== "no_data";
      item.el.innerHTML = `${showRank ? `<span class="rank">#${rk.rank}${rk.tie ? "=" : ""}</span>` : ""}<span class="nm">${a.name[lang]}</span>`;
    }
    // Sensor marker (WTR-01 / RAIN-01 share the virtual point).
    if (!sensorMarker.current) {
      const node = el("sim-sensor");
      sensorMarker.current = { el: node, m: new maplibregl.Marker({ element: node }).setLngLat([BASIN.sensor.lng, BASIN.sensor.lat]).addTo(map) };
    }
    const s = sensorMarker.current;
    const l0 = state?.l0 ?? "unknown";
    const alerting = layers.alerts && (l0 === "warning" || l0 === "danger");
    s.el.style.display = layers.sensors ? "" : "none";
    s.el.style.setProperty("--c", layers.sensorStatus ? L0C[l0] : "#8ea4a0");
    s.el.innerHTML = `${alerting ? '<span class="ring"></span>' : ""}<span class="dot"></span><span class="tag">WTR-01 · RAIN-01</span>`;
  }, [state, ready, selectedArea, whatif, whatifOffset, layers, lang]);

  // Layer visibility.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const k of LAYER_KEYS) for (const id of LAYERS_OF[k]) map.setLayoutProperty(id, "visibility", layers[k] ? "visible" : "none");
    map.setLayoutProperty("area-line", "visibility", "visible");
  }, [layers, ready]);

  return (
    <div className={className} style={{ position: "relative" }}>
      <div ref={box} className="rasd-map h-full w-full" />
      <div className="pointer-events-none absolute start-3 top-3 rounded-md border border-[#c2410c]/50 bg-[#3b1206]/80 px-2 py-1 text-[10px] font-bold tracking-wide text-[#fed7aa]" dir="ltr">
        VIRTUAL GEOGRAPHY · SIMULATED — not real areas or roads
      </div>
    </div>
  );
}
