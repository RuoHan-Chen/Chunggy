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
