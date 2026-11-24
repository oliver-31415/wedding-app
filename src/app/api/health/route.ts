import { sql } from "drizzle-orm";
import { db } from "@/db";

// Checked live on every request — never pre-rendered at build time.
export const dynamic = "force-dynamic";

/** For Docker's health check and uptime monitors. */
export async function GET() {
  try {
    await db.run(sql`select 1`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
