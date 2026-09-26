import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createSession, SESSION_COOKIE } from "@/lib/auth";

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export async function POST(req: Request) {
  const { username, password } = (await req.json().catch(() => ({}))) as { username?: string; password?: string };
  const okUser = same(String(username ?? ""), process.env.ADMIN_USER ?? "");
  const okPass = same(String(password ?? ""), process.env.ADMIN_PASSWORD ?? "");
  if (!okUser || !okPass || !process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSession(String(username)), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
