// Applies drizzle/ migrations to DATABASE_URL (default file:./data/wedding.db).
import { mkdirSync } from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const url = process.env.DATABASE_URL ?? "file:./data/wedding.db";
if (url.startsWith("file:")) mkdirSync("data", { recursive: true });
const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
if (url.startsWith("file:")) await client.execute("PRAGMA journal_mode = WAL");
await client.execute("PRAGMA foreign_keys = ON");
await migrate(drizzle(client), { migrationsFolder: "drizzle" });
console.log("Migrated", url);
