import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? "file:./data/wedding.db";

const globalForDb = globalThis as unknown as { client?: ReturnType<typeof createClient> };
function connect() {
  // libsql can't create the folder itself (fresh server, or `next build` in Docker).
  if (url.startsWith("file:")) mkdirSync(path.dirname(url.slice("file:".length)), { recursive: true });
  const c = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  if (url.startsWith("file:")) {
    // Local SQLite: wait (rather than fail) when another request is writing,
    // and enforce foreign keys. Queued before any other statement on this
    // connection. WAL mode is set once, by scripts/migrate.mts.
    void c.execute("PRAGMA busy_timeout = 5000");
    void c.execute("PRAGMA foreign_keys = ON");
  }
  return c;
}

const client = globalForDb.client ?? connect();
if (process.env.NODE_ENV !== "production") globalForDb.client = client;

export const db = drizzle(client, { schema });
export type Db = typeof db;
export { schema };
