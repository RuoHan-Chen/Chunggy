import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { runMigrations } = await import("../../src/server/database/migrations/runner");

  try {
    const result = await runMigrations();

    if (result.applied.length === 0) {
      console.log(`Database is current (${result.alreadyApplied.length} migrations).`);
    } else {
      for (const migration of result.applied) {
        console.log(`Applied ${migration.version}: ${migration.name}`);
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Database migration failed");
    process.exitCode = 1;
  } finally {
    const { getPool } = await import("../../src/lib/db");
    const pool = await getPool().catch(() => null);
    await pool?.close(0);
  }
}

void main();
