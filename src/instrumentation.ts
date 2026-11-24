// Runs once when the server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is not set. Add it to .env (generate one with: openssl rand -hex 32).");
  }
  if (process.env.RUN_MIGRATIONS !== "0") {
    const { runMigrations } = await import("./db/run-migrations");
    await runMigrations();
  }
}
