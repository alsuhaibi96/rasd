const LOCALE = "ar-SA-u-ca-gregory-nu-latn";
// Fixed zone so server- and client-rendered times always match (and read as Saudi local time).
const TZ = "Asia/Riyadh";

const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: TZ });
const shortTimeFmt = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });
const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });
const dayFmt = new Intl.DateTimeFormat(LOCALE, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ });

export const fmtTime = (iso: string | null | undefined) => (iso ? timeFmt.format(new Date(iso)) : "—");
export const fmtShortTime = (iso: string | number) => shortTimeFmt.format(new Date(iso));
export const fmtDateTime = (iso: string | null | undefined) => (iso ? dateTimeFmt.format(new Date(iso)) : "—");
export const fmtDay = (d: Date) => dayFmt.format(d);

export function timeAgo(iso: string | null | undefined, now: number): string {
  if (!iso) return "لا توجد بيانات";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 5) return "الآن";
  if (s < 60) return `منذ ${s} ث`;
  const m = Math.floor(s / 60);
  if (m < 60) return `منذ ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `منذ ${h} س`;
  return `منذ ${Math.floor(h / 24)} يوم`;
}

/** A reading is "live" if it arrived within this window. */
export const STALE_MS = 60_000;
export const isStale = (iso: string | null | undefined, now: number) => !iso || now - Date.parse(iso) > STALE_MS;
