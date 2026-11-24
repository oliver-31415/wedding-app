// Runs once when the server starts.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.RUN_MIGRATIONS !== "0") {
    const { runMigrations } = await import("./db/run-migrations");
    await runMigrations();
  }
}
