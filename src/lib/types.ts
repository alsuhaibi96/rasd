export type Status = "normal" | "warning" | "danger" | "unknown";
export type AlertLevel = "warning" | "danger";
export type Source = "device" | "simulator";
export type SensorType = "water_level" | "smoke_gas" | "temperature" | "humidity" | "pressure" | "vibration";

export interface Station {
  id: number;
  code: string;
  name_ar: string;
  city_ar: string;
  region_code: string;
  lat: number;
  lng: number;
}

export interface Sensor {
  id: number;
  code: string;
  station_id: number;
  type: SensorType;
  unit: string;
  last_value: number | null;
  last_status: Status;
  last_source: Source;
  last_seen_at: string | null;
}

export interface Threshold {
  sensor_type: SensorType;
  warning: number | null;
  danger: number | null;
  direction: "above" | "below";
  min_value: number;
  max_value: number;
  updated_at: string;
}

export interface Reading {
  id: number;
  sensor_id: number;
  value: number;
  status: Status;
  source: Source;
  created_at: string;
}

export interface Alert {
  id: number;
  sensor_id: number;
  reading_id: number | null;
  level: AlertLevel;
  value: number;
  threshold: number;
  source: Source;
  created_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
}

export interface Snapshot {
  stations: Station[];
  sensors: Sensor[];
  thresholds: Threshold[];
  alerts: Alert[];
  simulator: boolean;
  serverTime: string;
}

export type RealtimeEvent =
  | { type: "reading"; sensor: Sensor; reading: Reading }
  | { type: "alert"; alert: Alert }
  | { type: "ack"; alert: Alert }
  | { type: "thresholds"; thresholds: Threshold[]; sensors: Sensor[] };
