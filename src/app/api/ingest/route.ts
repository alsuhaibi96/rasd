import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { IngestError, ingestReading } from "@/lib/ingest";

export const dynamic = "force-dynamic";

function authorized(req: Request) {
  const expected = process.env.INGEST_API_KEY;
  const got = req.headers.get("x-device-key") ?? new URL(req.url).searchParams.get("key");
  if (!expected || !got) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(got);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Accepts any of:
 *   { "sensor": "WTR-01", "value": 82 }
 *   [ { "sensor": "WTR-01", "value": 82 }, { "sensor": "GAS-01", "value": 340 } ]
 *   { "readings": { "WTR-01": 82, "GAS-01": 340 } }
 */
function parse(body: unknown): { sensor: string; value: number }[] {
  if (Array.isArray(body)) return body.flatMap(parse);
  if (body && typeof body === "object") {
    const o = body as Record<string, unknown>;
    if (o.readings && typeof o.readings === "object" && !Array.isArray(o.readings)) {
      return Object.entries(o.readings as Record<string, unknown>).map(([sensor, value]) => ({ sensor, value: Number(value) }));
    }
    if (Array.isArray(o.readings)) return parse(o.readings);
    if (typeof o.sensor === "string") return [{ sensor: o.sensor, value: Number(o.value) }];
  }
  throw new IngestError("صيغة الطلب غير صحيحة");
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "مفتاح الجهاز غير صحيح" }, { status: 401 });
  try {
    const items = parse(await req.json().catch(() => null));
    if (items.length === 0 || items.length > 50) throw new IngestError("عدد القراءات يجب أن يكون بين 1 و 50");
    const results = [];
    for (const { sensor, value } of items) {
      const r = await ingestReading(sensor, value, "device");
      results.push({ sensor, value, status: r.reading.status, alert: r.alert?.level ?? null });
    }
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    const status = e instanceof IngestError ? e.status : 500;
    if (status === 500) console.error("[ingest]", e);
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
