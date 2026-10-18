import type oracledb from "oracledb";

import { getPool } from "@/lib/db";

export async function withConnection<T>(
  work: (connection: oracledb.Connection) => Promise<T>,
): Promise<T> {
  const pool = await getPool();
  const connection = await pool.getConnection();

  try {
    return await work(connection);
  } finally {
    await connection.close();
  }
}

export async function withTransaction<T>(
  work: (connection: oracledb.Connection) => Promise<T>,
): Promise<T> {
  return withConnection(async (connection) => {
    try {
      const result = await work(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  });
}
