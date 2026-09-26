import type { SensorType, Status } from "./types";

export const SENSOR_META: Record<SensorType, { label: string; hazard: string; unitLabel: string; decimals: number }> = {
  water_level: { label: "مستوى المياه", hazard: "ارتفاع مستوى المياه", unitLabel: "سم", decimals: 0 },
  smoke_gas: { label: "دخان / غاز", hazard: "ارتفاع مؤشر الدخان", unitLabel: "قيمة خام", decimals: 0 },
  temperature: { label: "درجة الحرارة", hazard: "ارتفاع درجة الحرارة", unitLabel: "°C", decimals: 1 },
  humidity: { label: "الرطوبة", hazard: "ارتفاع الرطوبة", unitLabel: "%", decimals: 0 },
  pressure: { label: "الضغط الجوي", hazard: "انخفاض الضغط الجوي", unitLabel: "hPa", decimals: 0 },
  vibration: { label: "الاهتزاز", hazard: "اهتزاز غير طبيعي", unitLabel: "g", decimals: 2 },
};

export const STATUS_LABEL: Record<Status, string> = {
  normal: "طبيعي",
  warning: "تحذير",
  danger: "خطر",
  unknown: "غير مصنّف",
};

export const STATUS_COLOR: Record<Status, string> = {
  normal: "#34d399",
  warning: "#fbbf24",
  danger: "#f43f5e",
  unknown: "#7b8d91",
};

export function formatValue(type: SensorType, v: number | null | undefined): string {
  if (v == null) return "—";
  return v.toFixed(SENSOR_META[type].decimals);
}
