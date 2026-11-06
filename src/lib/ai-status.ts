import { existsSync } from "node:fs";

export type AiState = "not_configured" | "not_available" | "loading" | "ready" | "running" | "error";

/**
 * Spec §7.4: the AI status reflects the actual runtime, never a static label.
 * No model runtime is integrated in this release, so even a present file is reported as Not Available.
 */
export function aiStatus(): { state: AiState; detail: string; model_version: string | null } {
  const path = process.env.AI_MODEL_PATH;
  if (!path) return { state: "not_configured", detail: "AI_MODEL_PATH is not set; no trained model is connected", model_version: null };
  if (!existsSync(path)) return { state: "not_available", detail: `Model file not found at configured path`, model_version: null };
  return { state: "not_available", detail: "A model file exists but no model runtime is integrated in this release", model_version: null };
}
