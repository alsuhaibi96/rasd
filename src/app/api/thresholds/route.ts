import { NextResponse } from "next/server";
import { saveThresholds } from "@/lib/repo";

const num = (v: unknown) => (v === null || v === "" || v === undefined ? null : Number(v));

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  if (!Array.isArray(body)) return NextResponse.json({ error: "صيغة الطلب غير صحيحة" }, { status: 400 });
  const input = body.map((t) => ({ sensor_type: String(t.sensor_type), warning: num(t.warning), danger: num(t.danger) })) as Parameters<typeof saveThresholds>[0];
  if (input.some((t) => [t.warning, t.danger].some((v) => v !== null && !Number.isFinite(v)))) {
    return NextResponse.json({ error: "قيم الحدود يجب أن تكون أرقامًا" }, { status: 400 });
  }
  try {
    return NextResponse.json(await saveThresholds(input));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
