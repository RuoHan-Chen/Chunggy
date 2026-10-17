import oracledb from "oracledb";

import { getOracleEnvironment } from "@/lib/env";

let poolPromise: Promise<oracledb.Pool> | undefined;

export function getPool() {
  if (!poolPromise) {
    const env = getOracleEnvironment();

    poolPromise = oracledb
      .createPool({
        user: env.ORACLE_USER,
        password: env.ORACLE_PASSWORD,
        connectString: env.ORACLE_CONNECT_STRING,
        configDir: env.walletLocation,
        walletLocation: env.walletLocation,
        walletPassword: env.walletPassword,
        poolMin: 0,
        poolMax: 5,
        poolIncrement: 1,
      })
      .catch((error) => {
        poolPromise = undefined;
        throw error;
      });
  }

  return poolPromise;
}

export async function checkDatabaseConnection() {
  const pool = await getPool();
  const connection = await pool.getConnection();

  try {
    const result = await connection.execute<{ value: number }>(
      'SELECT 1 AS "value" FROM DUAL',
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    return result.rows?.[0]?.value === 1;
  } finally {
    await connection.close();
  }
}

type DatabaseDetailsRow = {
  currentUser: string;
  databaseName: string;
  serviceName: string;
  databaseTime: string;
};

type TableRow = {
  tableName: string;
};

export type DatabaseOverview = DatabaseDetailsRow & {
  tableCount: number;
  tables: string[];
};

export async function getDatabaseOverview(): Promise<DatabaseOverview> {
  const pool = await getPool();
  const connection = await pool.getConnection();

  try {
    const details = await connection.execute<DatabaseDetailsRow>(
      `SELECT
        SYS_CONTEXT('USERENV', 'CURRENT_USER') AS "currentUser",
        SYS_CONTEXT('USERENV', 'DB_NAME') AS "databaseName",
        SYS_CONTEXT('USERENV', 'SERVICE_NAME') AS "serviceName",
        TO_CHAR(SYSTIMESTAMP, 'YYYY-MM-DD"T"HH24:MI:SS.FF3 TZH:TZM') AS "databaseTime"
      FROM DUAL`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const tableCount = await connection.execute<{ count: number }>(
      'SELECT COUNT(*) AS "count" FROM USER_TABLES',
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const tables = await connection.execute<TableRow>(
      `SELECT TABLE_NAME AS "tableName"
       FROM USER_TABLES
       ORDER BY TABLE_NAME
       FETCH FIRST 20 ROWS ONLY`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    const detailsRow = details.rows?.[0];
    if (!detailsRow) {
      throw new Error("Oracle did not return database metadata");
    }

    return {
      ...detailsRow,
      tableCount: tableCount.rows?.[0]?.count ?? 0,
      tables: tables.rows?.map((row) => row.tableName) ?? [],
    };
  } finally {
    await connection.close();
  }
}
