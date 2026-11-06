"use client";
import { create } from "zustand";

export type EvidenceTarget =
  | { kind: "l1"; tick?: number }
  | { kind: "area"; id: string }
  | { kind: "rec"; id: string }
  | { kind: "stage"; id: string };

export const useEvidence = create<{ target: EvidenceTarget | null; open: (t: EvidenceTarget) => void; close: () => void }>((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}));
