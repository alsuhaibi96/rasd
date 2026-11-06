import { ROAD_EDGES, ROAD_NODES } from "./geo";
import type { RouteResult } from "./types";

const R = 6371;
export function km(a: { lng: number; lat: number }, b: { lng: number; lat: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const nodeById = new Map(ROAD_NODES.map((n) => [n.id, n]));
export const EDGE_KM = new Map(ROAD_EDGES.map((e) => [e.id, km(nodeById.get(e.a)!, nodeById.get(e.b)!)]));
export const accessNode = (areaId: string) => ROAD_NODES.find((n) => n.area_id === areaId)?.id ?? null;

/** Dijkstra over the virtual network, excluding closed segments. Deterministic tie-break by node id. */
export function shortestPath(from: string, to: string, closed: Set<string>): { nodes: string[]; edges: string[]; km: number } | null {
  const dist = new Map<string, number>([[from, 0]]);
  const prev = new Map<string, { node: string; edge: string }>();
  const done = new Set<string>();
  while (true) {
    let u: string | null = null;
    for (const [k, d] of dist) if (!done.has(k) && (u == null || d < dist.get(u)! || (d === dist.get(u)! && k < u))) u = k;
    if (u == null) return null;
    if (u === to) break;
    done.add(u);
    for (const e of ROAD_EDGES) {
      if (closed.has(e.id) || (e.a !== u && e.b !== u)) continue;
      const v = e.a === u ? e.b : e.a;
      const nd = dist.get(u)! + EDGE_KM.get(e.id)!;
      if (nd < (dist.get(v) ?? Infinity) - 1e-9) {
        dist.set(v, nd);
        prev.set(v, { node: u, edge: e.id });
      }
    }
  }
  const nodes = [to];
  const edges: string[] = [];
  let cur = to;
  while (cur !== from) {
    const p = prev.get(cur)!;
    edges.unshift(p.edge);
    nodes.unshift(p.node);
    cur = p.node;
  }
  return { nodes, edges, km: Math.round(dist.get(to)! * 100) / 100 };
}

/** ROUTE-v0.1 — virtual route from the operations base to the target area, never a real navigation instruction. */
export function computeRoute(targetArea: string, closures: string[], previous: RouteResult | null): RouteResult {
  const closed = new Set(closures);
  const to = accessNode(targetArea);
  const unaffectedPath = to ? shortestPath("OPS", to, new Set()) : null;
  const p = to ? shortestPath("OPS", to, closed) : null;
  const excluded = (unaffectedPath?.edges ?? [])
    .filter((id) => closed.has(id))
    .map((edge_id) => ({ edge_id, reason: { en: `Segment ${edge_id} is virtually closed by the operator`, ar: `المقطع ${edge_id} مغلق افتراضيًا من قبل المشغّل` } }));
  const prevEdges = previous && previous.target_area_id === targetArea ? previous.edges : null;
  if (!p)
    return {
      target_area_id: targetArea,
      status: "no_route",
      nodes: [],
      edges: [],
      length_km: null,
      excluded,
      previous_edges: prevEdges,
      explanation: { en: "No alternative route is available within the virtual road network.", ar: "لا يوجد مسار بديل متاح ضمن شبكة الطرق الافتراضية." },
    };
  const alt = excluded.length > 0;
  return {
    target_area_id: targetArea,
    status: "ok",
    nodes: p.nodes,
    edges: p.edges,
    length_km: p.km,
    excluded,
    previous_edges: prevEdges,
    explanation: alt
      ? { en: `Simulated alternative route (${p.km} km) avoiding ${excluded.map((x) => x.edge_id).join(", ")}.`, ar: `مسار بديل محاكى (${p.km} كم) يتجنب ${excluded.map((x) => x.edge_id).join("، ")}.` }
      : { en: `Simulated shortest route (${p.km} km) in the virtual network.`, ar: `أقصر مسار محاكى (${p.km} كم) في الشبكة الافتراضية.` },
  };
}
