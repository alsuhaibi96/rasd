/*
 * RASD — ESP32 sensor node
 * Reads a water-level ultrasonic sensor (HC-SR04 / JSN-SR04T) and an MQ-2 smoke/gas sensor
 * and POSTs them to the RASD platform every SEND_INTERVAL_MS.
 *
 * Wiring (ESP32 DevKit):
 *   Ultrasonic TRIG -> GPIO 5,  ECHO -> GPIO 18 (use a voltage divider: ECHO is 5V on HC-SR04)
 *   MQ-2 AO         -> GPIO 34 (ADC1, 0..4095)
 *
 * Libraries: ArduinoJson (v7) — install from Library Manager.
 */
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// ---- Configure -------------------------------------------------------------
const char* WIFI_SSID     = "YOUR_WIFI";
const char* WIFI_PASSWORD = "YOUR_PASSWORD";
const char* INGEST_URL    = "https://rasd.alsuhaibi96.com/api/ingest";
const char* DEVICE_KEY    = "PUT_INGEST_API_KEY_HERE";

// Sensor codes as registered in the platform (see /stations).
const char* WATER_SENSOR = "WTR-01";
const char* GAS_SENSOR   = "GAS-01";

// Distance from the ultrasonic sensor to the bottom of the channel/tank, in cm.
// Water level = MOUNT_HEIGHT_CM - measured distance.
const float MOUNT_HEIGHT_CM = 120.0;
const unsigned long SEND_INTERVAL_MS = 2000;
// ---------------------------------------------------------------------------

const int TRIG_PIN = 5;
const int ECHO_PIN = 18;
const int GAS_PIN  = 34;

float readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long us = pulseIn(ECHO_PIN, HIGH, 30000);  // timeout ~5 m
  if (us == 0) return NAN;
  return us * 0.0343 / 2.0;
}

float readWaterLevelCm() {
  // Median of 5 samples to reject ultrasonic spikes.
  float s[5];
  for (int i = 0; i < 5; i++) { s[i] = readDistanceCm(); delay(30); }
  for (int i = 0; i < 4; i++) for (int j = i + 1; j < 5; j++) if (s[j] < s[i]) { float t = s[i]; s[i] = s[j]; s[j] = t; }
  float d = s[2];
  if (isnan(d)) return NAN;
  return constrain(MOUNT_HEIGHT_CM - d, 0, MOUNT_HEIGHT_CM);
}

int readGasRaw() {
  long sum = 0;
  for (int i = 0; i < 8; i++) { sum += analogRead(GAS_PIN); delay(5); }
  return sum / 8;
}

void connectWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("WiFi");
  for (int i = 0; i < 40 && WiFi.status() != WL_CONNECTED; i++) { delay(250); Serial.print("."); }
  Serial.println(WiFi.status() == WL_CONNECTED ? " connected" : " failed");
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  analogReadResolution(12);
  connectWifi();
}

void loop() {
  static unsigned long last = 0;
  if (millis() - last < SEND_INTERVAL_MS) return;
  last = millis();
  connectWifi();
  if (WiFi.status() != WL_CONNECTED) return;

  JsonDocument doc;
  JsonObject readings = doc["readings"].to<JsonObject>();
  float level = readWaterLevelCm();
  if (!isnan(level)) readings[WATER_SENSOR] = round(level * 10) / 10.0;
  readings[GAS_SENSOR] = readGasRaw();
  String body;
  serializeJson(doc, body);

  WiFiClientSecure client;
  client.setInsecure();  // prototype: skip certificate pinning
  HTTPClient http;
  http.begin(client, INGEST_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);
  int code = http.POST(body);
  Serial.printf("POST %s -> %d %s\n", body.c_str(), code, http.getString().c_str());
  http.end();
}
