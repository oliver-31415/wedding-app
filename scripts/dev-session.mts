// Dev helper for headless testing: prints a session token for a host account.
//   T=$(pnpm -s tsx scripts/dev-session.mts [email]) ; curl -b "wa_session=$T" …
// In Playwright: context.addCookies([{ name: "wa_session", value: T, url: "http://localhost:PORT" }])
import { createClient } from "@libsql/client";
import { createHash, randomBytes } from "node:crypto";

const email = process.argv[2] ?? "demo@example.com";
const c = createClient({ url: process.env.DATABASE_URL ?? "file:./data/wedding.db" });
const u = await c.execute({ sql: "select id from users where email = ?", args: [email] });
if (!u.rows.length) throw new Error(`No user ${email} — run pnpm db:seed`);
const token = randomBytes(24).toString("base64url");
await c.execute({
  sql: "insert into sessions (id, user_id, expires_at) values (?, ?, ?)",
  args: [createHash("sha256").update(token).digest("hex"), String(u.rows[0].id), Date.now() + 86_400_000],
});
console.log(token);
