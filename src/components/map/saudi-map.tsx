"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import type { ExpressionSpecification, MapLayerMouseEvent, StyleSpecification } from "maplibre-gl";
import { LocateFixed, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { regionStatuses, stationStatus } from "@/lib/derive";
import { SENSOR_META, STATUS_COLOR, STATUS_LABEL, formatValue } from "@/lib/sensor-meta";
import type { Sensor, Station, Status } from "@/lib/types";

maplibregl.setWorkerUrl("/vendor/maplibre/maplibre-gl-worker.mjs");

const KSA_BOUNDS: [[number, number], [number, number]] = [[34.4, 15.9], [55.9, 32.3]];

// Hand-placed label anchors [lng, lat] so labels sit clear of borders and station markers.
const REGION_LABELS: [string, string, [number, number], boolean?][] = [
  ["SA-01", "الرياض", [45.6, 22.4]],
  ["SA-02", "مكة المكرمة", [41.2, 21.9]],
  ["SA-03", "المدينة المنورة", [40.1, 24.3]],
  ["SA-04", "المنطقة الشرقية", [51.0, 21.9]],
  ["SA-05", "القصيم", [43.2, 26.1]],
  ["SA-06", "حائل", [40.5, 26.6]],
  ["SA-07", "تبوك", [37.9, 26.8]],
  ["SA-08", "الحدود الشمالية", [42.4, 30.0]],
  ["SA-09", "جازان", [43.2, 17.0], true],
  ["SA-10", "نجران", [46.8, 18.5]],
  ["SA-11", "الباحة", [41.7, 20.3], true],
  ["SA-12", "الجوف", [38.8, 29.3]],
  ["SA-14", "عسير", [44.3, 19.9]],
];
const GEO_LABELS: [string, [number, number], "sea" | "country" | "neighbor"][] = [
  ["العراق", [43.6, 32.6], "neighbor"],
  ["الأردن", [36.9, 31.0], "neighbor"],
  ["الكويت", [47.5, 29.35], "neighbor"],
  ["قطر", [51.2, 25.3], "neighbor"],
  ["الإمارات", [54.4, 23.5], "neighbor"],
  ["عُمان", [56.9, 20.6], "neighbor"],
  ["اليمن", [47.0, 15.4], "neighbor"],
  ["مصر", [31.8, 26.0], "neighbor"],
  ["السودان", [33.3, 18.6], "neighbor"],
  ["إيران", [53.0, 30.8], "neighbor"],
  ["البحر الأحمر", [37.3, 22.4], "sea"],
  ["الخليج العربي", [51.9, 27.2], "sea"],
  ["بحر العرب", [59.5, 16.5], "sea"],
  ["المملكة العربية السعودية", [42.9, 23.4], "country"],
];

const statusFill = (alpha: Record<Status, number>, hoverBoost: number): ExpressionSpecification => [
  "let",
  "s",
  ["coalesce", ["feature-state", "status"], "unknown"],
  [
    "match",
    ["var", "s"],
    "danger", ["rgba", 244, 63, 94, ["+", alpha.danger, ["case", ["boolean", ["feature-state", "hover"], false], hoverBoost, 0]]],
    "warning", ["rgba", 251, 191, 36, ["+", alpha.warning, ["case", ["boolean", ["feature-state", "hover"], false], hoverBoost, 0]]],
    "normal", ["rgba", 52, 211, 153, ["+", alpha.normal, ["case", ["boolean", ["feature-state", "hover"], false], hoverBoost, 0]]],
    ["rgba", 120, 160, 160, ["+", alpha.unknown, ["case", ["boolean", ["feature-state", "hover"], false], hoverBoost, 0]]],
  ],
];

const STYLE: StyleSpecification = {
  version: 8,
  sources: {
    neighbors: { type: "geojson", data: "/geo/neighbors.geojson" },
    regions: { type: "geojson", data: "/geo/ksa-regions.geojson", promoteId: "code" },
    outline: { type: "geojson", data: "/geo/ksa-outline.geojson" },
  },
  layers: [
    { id: "sea", type: "background", paint: { "background-color": "#08161b" } },
    { id: "neighbors-fill", type: "fill", source: "neighbors", paint: { "fill-color": "#0e1b1f" } },
    { id: "neighbors-line", type: "line", source: "neighbors", paint: { "line-color": "#1f3237", "line-width": 0.7 } },
    { id: "ksa-base", type: "fill", source: "regions", paint: { "fill-color": "#112429" } },
    { id: "regions-fill", type: "fill", source: "regions", paint: { "fill-color": statusFill({ danger: 0.2, warning: 0.13, normal: 0.035, unknown: 0.02 }, 0.08) } },
    { id: "ksa-glow", type: "line", source: "outline", paint: { "line-color": "#34d399", "line-width": 10, "line-blur": 9, "line-opacity": 0.12 } },
    { id: "regions-line", type: "line", source: "regions", paint: { "line-color": "#2c4a50", "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.6, 8, 1.4], "line-dasharray": [3, 2] } },
    { id: "ksa-line", type: "line", source: "outline", paint: { "line-color": "#48b79a", "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.1, 8, 2.2], "line-opacity": 0.75 } },
  ],
};

/** Pick a label side so neighbouring stations don't collide: below by default. */
function labelSide(st: Station, all: Station[]): "" | " up" | " east" {
  const others = all.filter((o) => o.id !== st.id);
  if (others.some((o) => Math.abs(o.lat - st.lat) < 0.5 && st.lng > o.lng && st.lng - o.lng < 1)) return " up";
  if (others.some((o) => Math.abs(o.lng - st.lng) < 1.2 && st.lat - o.lat > 0.5 && st.lat - o.lat < 1.6)) return " east";
  return "";
}

function el(className: string, text?: string) {
  const d = document.createElement("div");
  d.className = className;
  if (text) d.textContent = text;
  return d;
}

function popupHtml(st: Station, sensors: Sensor[]) {
  const rows = sensors
    .map((s) => {
      const m = SENSOR_META[s.type];
      return `<div style="display:flex;align-items:center;gap:8px;justify-content:space-between;margin-top:6px;font-size:12px">
        <span style="color:#8ea4a0">${m.label}</span>
        <span style="display:inline-flex;align-items:center;gap:6px"><b class="num">${formatValue(s.type, s.last_value)}</b><span style="color:#8ea4a0">${m.unitLabel}</span>
        <span style="color:${STATUS_COLOR[s.last_status]};font-size:11px">● ${STATUS_LABEL[s.last_status]}</span></span></div>`;
    })
    .join("");
  return `<div style="min-width:190px"><div style="font-weight:700;font-size:13px">${st.name_ar}، ${st.city_ar}</div>
    <div style="color:#5d7571;font-size:11px">${st.code}</div>${rows}</div>`;
}

interface Props {
  stations: Station[];
  sensors: Sensor[];
  selectedStationId?: number | null;
  onSelectStation?: (id: number) => void;
  className?: string;
}

export default function SaudiMap({ stations, sensors, selectedStationId, onSelectStation, className }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef(new Map<number, { el: HTMLElement; popup: maplibregl.Popup }>());
  const [ready, setReady] = useState(false);
  const [hoverRegion, setHoverRegion] = useState<string | null>(null);
  const onSelect = useRef(onSelectStation);
  onSelect.current = onSelectStation;

  // Create the map once.
  useEffect(() => {
    if (!box.current) return;
    const map = new maplibregl.Map({
      container: box.current,
      style: STYLE,
      bounds: KSA_BOUNDS,
      fitBoundsOptions: { padding: 24 },
      minZoom: 3.2,
      maxZoom: 9,
      maxBounds: [[22, 4], [68, 40]],
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: false,
      renderWorldCopies: false,
    });
    map.touchZoomRotate.disableRotation();
    map.keyboard.disableRotation();
    mapRef.current = map;

    const setZoomClass = () => box.current?.setAttribute("data-zoom", map.getZoom() < 5.2 ? "low" : "high");
    map.on("zoom", setZoomClass);
    setZoomClass();

    for (const [name, lnglat, kind] of GEO_LABELS) {
      new maplibregl.Marker({ element: el(`rasd-geo-label ${kind}`, name) }).setLngLat(lnglat).addTo(map);
    }

    let hovered: string | null = null;
    map.on("mousemove", "regions-fill", (e: MapLayerMouseEvent) => {
      const id = e.features?.[0]?.id as string | undefined;
      if (id === hovered) return;
      if (hovered) map.setFeatureState({ source: "regions", id: hovered }, { hover: false });
      hovered = id ?? null;
      if (hovered) map.setFeatureState({ source: "regions", id: hovered }, { hover: true });
      setHoverRegion(hovered);
    });
    map.on("mouseleave", "regions-fill", () => {
      if (hovered) map.setFeatureState({ source: "regions", id: hovered }, { hover: false });
      hovered = null;
      setHoverRegion(null);
    });
    map.on("load", () => setReady(true));

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(box.current);
    const markerMap = markers.current;
    return () => {
      ro.disconnect();
      markerMap.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Region labels, skipping any region whose name a station label already shows.
  const regionLabels = useRef<maplibregl.Marker[]>([]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    regionLabels.current.forEach((m) => m.remove());
    const cities = new Set(stations.map((s) => s.city_ar));
    regionLabels.current = REGION_LABELS.filter(([, name]) => !cities.has(name)).map(([, name, lnglat, minor]) =>
      new maplibregl.Marker({ element: el(`rasd-region-label${minor ? " minor" : ""}`, name) }).setLngLat(lnglat).addTo(map),
    );
  }, [stations]);

  // Station markers (created once per station, then updated in place).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const st of stations) {
      if (markers.current.has(st.id)) continue;
      const m = document.createElement("button");
      m.className = "rasd-marker";
      m.setAttribute("aria-label", `${st.name_ar}، ${st.city_ar}`);
      m.innerHTML = `<span class="halo"></span><span class="ring"></span><span class="ring r2"></span><span class="core"></span><span class="lbl${labelSide(st, stations)}">${st.city_ar}</span>`;
      const popup = new maplibregl.Popup({ className: "rasd-popup", closeButton: false, closeOnClick: false, offset: 18, maxWidth: "280px" });
      m.addEventListener("mouseenter", () => popup.setLngLat([st.lng, st.lat]).addTo(map));
      m.addEventListener("mouseleave", () => popup.remove());
      m.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelect.current?.(st.id);
      });
      new maplibregl.Marker({ element: m }).setLngLat([st.lng, st.lat]).addTo(map);
      markers.current.set(st.id, { el: m, popup });
    }
  }, [stations]);

  // Live status → markers, popups and region tint.
  useEffect(() => {
    for (const st of stations) {
      const mk = markers.current.get(st.id);
      if (!mk) continue;
      const own = sensors.filter((s) => s.station_id === st.id);
      mk.el.dataset.status = stationStatus(st.id, sensors);
      mk.el.dataset.selected = String(st.id === selectedStationId);
      mk.popup.setHTML(popupHtml(st, own));
    }
    const map = mapRef.current;
    if (!map || !ready) return;
    const rs = regionStatuses(stations, sensors);
    for (const [code] of REGION_LABELS) map.setFeatureState({ source: "regions", id: code }, { status: rs[code] ?? "unknown" });
  }, [stations, sensors, selectedStationId, ready]);

  const regionName = useMemo(() => REGION_LABELS.find(([c]) => c === hoverRegion)?.[1], [hoverRegion]);
  const regionStatus = hoverRegion ? regionStatuses(stations, sensors)[hoverRegion] : undefined;

  const ctl = "grid size-9 place-items-center text-muted transition hover:bg-surface-3 hover:text-fg";
  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      <div ref={box} className="rasd-map h-full w-full" />
      {!ready && <div className="absolute inset-0 animate-pulse bg-[#08161b]" />}

      <div className="absolute top-3 left-3 flex flex-col overflow-hidden rounded-xl border border-line-2 bg-surface/90 backdrop-blur">
        <button className={ctl} onClick={() => mapRef.current?.zoomIn()} aria-label="تكبير"><Plus className="size-4" /></button>
        <button className={`${ctl} border-y border-line`} onClick={() => mapRef.current?.zoomOut()} aria-label="تصغير"><Minus className="size-4" /></button>
        <button className={ctl} onClick={() => mapRef.current?.fitBounds(KSA_BOUNDS, { padding: 24 })} aria-label="إعادة الضبط"><LocateFixed className="size-4" /></button>
      </div>

      {regionName && (
        <div className="pointer-events-none absolute top-3 right-3 rounded-lg border border-line-2 bg-surface/90 px-3 py-1.5 text-xs backdrop-blur">
          <span className="font-semibold">منطقة {regionName}</span>
          {regionStatus && regionStatus !== "unknown" && (
            <span className="ms-2" style={{ color: STATUS_COLOR[regionStatus] }}>● {STATUS_LABEL[regionStatus]}</span>
          )}
        </div>
      )}

      <div className="absolute right-3 bottom-3 flex items-center gap-3 rounded-lg border border-line-2 bg-surface/90 px-3 py-1.5 text-xs backdrop-blur">
        {(["danger", "warning", "normal", "unknown"] as Status[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: STATUS_COLOR[s] }} />
            {STATUS_LABEL[s]}
          </span>
        ))}
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 text-[10px] text-dim">geoBoundaries · Natural Earth</div>
    </div>
  );
}
