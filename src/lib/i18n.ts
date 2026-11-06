"use client";
import { useRasd } from "./store";

export type Lang = "ar" | "en";
export const LANG_COOKIE = "rasd_lang";

/** Inline bilingual strings keep each label next to its translation: tr("نص", "Text"). */
export function useTr() {
  const lang = useRasd((s) => s.lang);
  return (ar: string, en: string) => (lang === "en" ? en : ar);
}
export function useLang() {
  return useRasd((s) => s.lang);
}
/** Picks a { ar, en } pair. */
export function useL() {
  const lang = useRasd((s) => s.lang);
  return (v: { ar: string; en: string } | null | undefined) => (v ? v[lang] : "");
}

export function setLang(lang: Lang) {
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
  window.location.reload();
}
