import { Client } from "pg";
import { pool } from "./db";
import type { RealtimeEvent } from "./types";

const CHANNEL = "rasd_events";
type Listener = (e: RealtimeEvent) => void;

interface Hub {
  listeners: Set<Listener>;
  client?: Client;
  connecting?: Promise<void>;
}

const g = globalThis as unknown as { __rasdHub?: Hub };
const hub: Hub = (g.__rasdHub ??= { listeners: new Set() });

/** One dedicated LISTEN connection per server process, fanned out to every SSE subscriber. */
function ensureListening(): Promise<void> {
  if (hub.client) return Promise.resolve();
  hub.connecting ??= (async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    const reset = () => {
      if (hub.client !== client) return;
      hub.client = undefined;
      client.end().catch(() => {});
      setTimeout(() => ensureListening().catch(() => {}), 2000);
    };
    client.on("notification", (msg) => {
      if (!msg.payload) return;
      const event = JSON.parse(msg.payload) as RealtimeEvent;
      for (const l of hub.listeners) l(event);
    });
    client.on("error", reset);
    client.on("end", reset);
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
    hub.client = client;
  })().finally(() => {
    hub.connecting = undefined;
  });
  return hub.connecting;
}

export async function subscribe(listener: Listener): Promise<() => void> {
  await ensureListening();
  hub.listeners.add(listener);
  return () => hub.listeners.delete(listener);
}

export async function publish(event: RealtimeEvent): Promise<void> {
  await pool.query("SELECT pg_notify($1, $2)", [CHANNEL, JSON.stringify(event)]);
}
