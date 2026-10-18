import oracledb from "oracledb";

import { withConnection } from "@/server/database/transaction";

import { migrations } from ".";
import type { Migration } from "./types";

const migrationTableSql = `CREATE TABLE SCHEMA_MIGRATIONS (
  VERSION NUMBER(10) NOT NULL,
  NAME VARCHAR2(200 CHAR) NOT NULL,
  APPLIED_AT TIMESTAMP(6) WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
  CONSTRAINT PK_SCHEMA_MIGRATIONS PRIMARY KEY (VERSION),
  CONSTRAINT UQ_SCHEMA_MIGR_NAME UNIQUE (NAME)
)`;

type AppliedMigrationRow = {
  version: number;
  name: string;
};

export type MigrationResult = {
  applied: Array<{ version: number; name: string }>;
  alreadyApplied: Array<{ version: number; name: string }>;
};

export async function runMigrations(): Promise<MigrationResult> {
  return withConnection(async (connection) => {
    await ensureMigrationTable(connection);

    const result = await connection.execute<AppliedMigrationRow>(
      `SELECT VERSION AS "version", NAME AS "name"
       FROM SCHEMA_MIGRATIONS
       ORDER BY VERSION`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const appliedByVersion = new Map(
      (result.rows ?? []).map((row) => [row.version, row.name]),
    );
    const plan = migrationPlan(migrations, appliedByVersion);
    const applied: MigrationResult["applied"] = [];

    for (const migration of plan.pending) {
      await applyMigration(connection, migration);
      applied.push({ version: migration.version, name: migration.name });
    }

    return {
      applied,
      alreadyApplied: plan.applied.map((migration) => ({
        version: migration.version,
        name: migration.name,
      })),
    };
  });
}

export function migrationPlan(
  available: Migration[],
  appliedByVersion: ReadonlyMap<number, string>,
) {
  const ordered = [...available].sort((a, b) => a.version - b.version);
  const seen = new Set<number>();
  const applied: Migration[] = [];
  const pending: Migration[] = [];

  for (const migration of ordered) {
    if (seen.has(migration.version)) {
      throw new Error(`Duplicate migration version ${migration.version}`);
    }
    seen.add(migration.version);

    const appliedName = appliedByVersion.get(migration.version);
    if (appliedName && appliedName !== migration.name) {
      throw new Error(
        `Migration ${migration.version} was applied as ${appliedName}, not ${migration.name}`,
      );
    }

    if (appliedName) applied.push(migration);
    else pending.push(migration);
  }

  return { applied, pending };
}

async function ensureMigrationTable(connection: oracledb.Connection) {
  try {
    await connection.execute(migrationTableSql);
  } catch (error) {
    if (!isOracleError(error, 955)) throw error;
  }
}

async function applyMigration(
  connection: oracledb.Connection,
  migration: Migration,
) {
  for (const statement of migration.statements) {
    try {
      await connection.execute(statement.sql, statement.binds ?? {});
    } catch (error) {
      const ignored = statement.ignoreOracleErrors?.some((number) =>
        isOracleError(error, number),
      );
      if (!ignored) throw error;
    }
  }

  await connection.execute(
    `INSERT INTO SCHEMA_MIGRATIONS (VERSION, NAME)
     VALUES (:version, :name)`,
    { version: migration.version, name: migration.name },
  );
  await connection.commit();
}

function isOracleError(error: unknown, errorNumber: number) {
  return (
    typeof error === "object" &&
    error !== null &&
    "errorNum" in error &&
    error.errorNum === errorNumber
  );
}
