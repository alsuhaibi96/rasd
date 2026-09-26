import { NextResponse } from "next/server";
import { acknowledgeAlert } from "@/lib/repo";
import { currentUser } from "@/lib/session";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = (await currentUser()) ?? "operator";
  const alert = await acknowledgeAlert(Number((await params).id), user);
  if (!alert) return NextResponse.json({ error: "التنبيه غير موجود أو تم تأكيده مسبقًا" }, { status: 409 });
  return NextResponse.json(alert);
}
