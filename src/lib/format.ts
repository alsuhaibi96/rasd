const LOCALE = "ar-SA-u-ca-gregory-nu-latn";
// Fixed zone so server- and client-rendered times always match (and read as Saudi local time).
const TZ = "Asia/Riyadh";

const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: TZ });
const shortTimeFmt = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });
const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });
const dayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ });
const LOCALE_EN = "en-GB";
const dateTimeFmtEn = new Intl.DateTimeFormat(LOCALE_EN, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });
const dayFmtEn = new Intl.DateTimeFormat(LOCALE_EN, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ });

export const fmtTime = (iso: string | null | undefined) => (iso ? timeFmt.format(new Date(iso)) : "—");
export const fmtShortTime = (iso: string | number) => shortTimeFmt.format(new Date(iso));
export const fmtDateTime = (iso: string | null | undefined, lang: "ar" | "en" = "ar") =>
  iso ? (lang === "en" ? dateTimeFmtEn : dateTimeFmt).format(new Date(iso)) : "—";
export const fmtDay = (d: Date, lang: "ar" | "en" = "ar") => (lang === "en" ? dayFmtEn : dayFmt).format(d);

export function timeAgo(iso: string | null | undefined, now: number, lang: "ar" | "en" = "ar"): string {
  const en = lang === "en";
  if (!iso) return en ? "No data" : "لا توجد بيانات";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 5) return en ? "just now" : "الآن";
  if (s < 60) return en ? `${s} s ago` : `منذ ${s} ث`;
  const m = Math.floor(s / 60);
  if (m < 60) return en ? `${m} min ago` : `منذ ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return en ? `${h} h ago` : `منذ ${h} س`;
  const d = Math.floor(h / 24);
  return en ? `${d} ${d === 1 ? "day" : "days"} ago` : `منذ ${d} يوم`;
}

/** A reading is "live" if it arrived within this window. */
export const STALE_MS = 60_000;
export const isStale = (iso: string | null | undefined, now: number) => !iso || now - Date.parse(iso) > STALE_MS;
