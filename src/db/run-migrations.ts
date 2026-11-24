// Applies pending migrations from ./drizzle when the server starts (see
// src/instrumentation.ts), so deploying a new image is all an update needs.
// Uses its own short-lived client: the app's client is server-only.
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

export async function runMigrations(): Promise<void> {
  const url = process.env.DATABASE_URL ?? "file:./data/wedding.db";
  if (url.startsWith("file:")) mkdirSync(path.dirname(url.slice("file:".length)), { recursive: true });
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  try {
    if (url.startsWith("file:")) await client.execute("PRAGMA journal_mode = WAL");
    await client.execute("PRAGMA foreign_keys = ON");
    await migrate(drizzle(client), { migrationsFolder: path.join(process.cwd(), "drizzle") });
  } finally {
    client.close();
  }
}
