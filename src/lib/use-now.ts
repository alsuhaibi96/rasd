"use client";
import { useSyncExternalStore } from "react";

let now = Date.now();
const subs = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(cb: () => void) {
  subs.add(cb);
  timer ??= setInterval(() => {
    now = Date.now();
    subs.forEach((s) => s());
  }, 1000);
  return () => {
    subs.delete(cb);
    if (!subs.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** Shared 1-second clock for "منذ X" labels. */
export function useNow(serverNow?: number) {
  return useSyncExternalStore(subscribe, () => now, () => serverNow ?? now);
}
