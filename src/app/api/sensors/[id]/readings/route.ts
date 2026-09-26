import { NextResponse } from "next/server";
import { getReadings } from "@/lib/repo";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 60);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
  return NextResponse.json(await getReadings(id, limit));
}
