import { classify, isEscalation } from "@/lib/severity";
import type { Status } from "@/lib/types";
import type { Limits } from "./types";

/**
 * L0 alert status for one reading — reuses the website's existing classifier (src/lib/severity.ts)
 * so the simulation and the live dashboard apply the same rule.
 */
export function l0Status(value: number | null, limits: Limits): Status {
  if (value == null) return "unknown";
  return classify(value, limits);
}

export { isEscalation };
