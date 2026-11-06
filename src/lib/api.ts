import { NextResponse } from "next/server";
import { RunError } from "./scenario/runner";
import { currentUser } from "./session";

/** Wraps a route handler: resolves the operator and maps RunError to a JSON error response. */
export function handler<A extends unknown[]>(fn: (user: string, ...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    try {
      const user = (await currentUser()) ?? "operator";
      const out = await fn(user, ...args);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof RunError) return NextResponse.json({ error: e.message, ...e.extra }, { status: e.status });
      console.error("[api]", e);
      return NextResponse.json({ error: (e as Error).message || "Server error" }, { status: 500 });
    }
  };
}
export const body = async (req: Request) => (await req.json().catch(() => ({}))) as Record<string, unknown>;
