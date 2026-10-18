import { loadEnvConfig } from "@next/env";
import oracledb from "oracledb";

loadEnvConfig(process.cwd());

const expectedTables = [
  "APP_USERS",
  "APPOINTMENTS",
  "APPOINTMENT_OPTIONS",
  "APPOINTMENT_TYPES",
  "CARE_REQUESTS",
  "CARE_REQUEST_CODES",
  "CONVERSATIONS",
  "CONVERSATION_CONTEXT",
  "INSURANCE_POLICIES",
  "MESSAGES",
  "OUTREACH_ATTEMPTS",
  "PATIENT_PROFILES",
  "PROVIDER_LOCATIONS",
  "PROVIDER_SERVICES",
  "SCHEMA_MIGRATIONS",
];

async function main() {
  const { withConnection } = await import("../../src/server/database/transaction");

  try {
    const verification = await withConnection(async (connection) => {
      const tables = await connection.execute<{ tableName: string }>(
        `SELECT TABLE_NAME AS "tableName"
         FROM USER_TABLES
         WHERE TABLE_NAME IN (${expectedTables.map((_, index) => `:table${index}`).join(", ")})
         ORDER BY TABLE_NAME`,
        Object.fromEntries(expectedTables.map((table, index) => [`table${index}`, table])),
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      const providers = await connection.execute<{ count: number }>(
        `SELECT COUNT(*) AS "count"
         FROM PROVIDER_LOCATIONS
         WHERE IS_ACTIVE = 1`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      const blockedDemoNumbers = await connection.execute<{ count: number }>(
        `SELECT COUNT(*) AS "count"
         FROM PROVIDER_LOCATIONS
         WHERE IS_ACTIVE = 1
           AND (
             PHONE_E164 IS NULL OR
             PHONE_E164 NOT IN ('+19172082802', '+18327578013')
           )`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );

      return {
        tables: tables.rows?.map((row) => row.tableName) ?? [],
        providerCount: providers.rows?.[0]?.count ?? 0,
        blockedDemoNumberCount: blockedDemoNumbers.rows?.[0]?.count ?? 0,
      };
    });

    const missingTables = expectedTables.filter(
      (table) => !verification.tables.includes(table),
    );
    if (missingTables.length > 0) {
      throw new Error(`Missing tables: ${missingTables.join(", ")}`);
    }
    if (verification.providerCount < 1) {
      throw new Error("No active provider seed data found");
    }
    if (verification.blockedDemoNumberCount > 0) {
      throw new Error(`${verification.blockedDemoNumberCount} active providers have a phone number outside the demo allowlist`);
    }

    console.log(
      `Database verified: ${verification.tables.length} tables, ${verification.providerCount} active providers.`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Database verification failed");
    process.exitCode = 1;
  } finally {
    const { getPool } = await import("../../src/lib/db");
    const pool = await getPool().catch(() => null);
    await pool?.close(0);
  }
}

void main();
