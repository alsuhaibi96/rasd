import { Pool, types } from "pg";

// bigint ids → number, timestamptz → ISO string (safe to pass to client components).
types.setTypeParser(20, (v) => Number(v));
types.setTypeParser(1184, (v) => new Date(v).toISOString());

const g = globalThis as unknown as { __rasdPool?: Pool };

export const pool: Pool = (g.__rasdPool ??= new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 8,
  idleTimeoutMillis: 30_000,
}));
