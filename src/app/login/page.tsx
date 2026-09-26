"use client";
import { LogIn } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/shell/logo";
import { Button } from "@/components/ui";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
    });
    if (res.ok) {
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next?.startsWith("/") ? next : "/";
    } else {
      setError((await res.json()).error);
      setBusy(false);
    }
  }

  const input = "mt-2 w-full rounded-xl border border-line-2 bg-bg px-4 py-3 text-sm outline-none transition focus:border-brand";
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(52,211,153,0.12),transparent_60%)]" />
      <form onSubmit={onSubmit} className="relative w-full max-w-sm rounded-3xl border border-line bg-surface/90 p-8 shadow-2xl backdrop-blur">
        <Logo />
        <p className="mt-4 text-sm text-muted">نظام الاستجابة الفورية للكوارث الطبيعية</p>
        <h1 className="mt-8 text-xl font-bold">تسجيل الدخول إلى مركز العمليات</h1>
        <label className="mt-6 block text-sm text-muted">
          اسم المستخدم
          <input name="username" autoComplete="username" required className={input} dir="ltr" />
        </label>
        <label className="mt-4 block text-sm text-muted">
          كلمة المرور
          <input name="password" type="password" autoComplete="current-password" required className={input} dir="ltr" />
        </label>
        {error && <p className="mt-4 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-[#ff9aab]">{error}</p>}
        <Button variant="primary" className="mt-6 w-full" disabled={busy}>
          <LogIn className="size-4 -scale-x-100" /> {busy ? "جارٍ الدخول…" : "دخول"}
        </Button>
      </form>
    </main>
  );
}
