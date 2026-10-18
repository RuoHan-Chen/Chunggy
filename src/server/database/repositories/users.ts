import "server-only";

import oracledb from "oracledb";

import { withConnection, withTransaction } from "@/server/database/transaction";
import { authIdentitySchema } from "@/server/database/validation";

type UserRow = {
  userId: string;
  email: string;
  displayName: string | null;
  status: "ACTIVE" | "DISABLED";
};

export type UserRecord = UserRow;

export async function upsertAuthenticatedUser(input: unknown): Promise<UserRecord> {
  const identity = authIdentitySchema.parse(input);
  const userId = crypto.randomUUID();

  return withTransaction(async (connection) => {
    await connection.execute(
      `MERGE INTO APP_USERS target
       USING (
         SELECT :userId USER_ID,
                :provider AUTH_PROVIDER,
                :subject AUTH_SUBJECT,
                :email EMAIL,
                :displayName DISPLAY_NAME
         FROM DUAL
       ) source
       ON (
         target.AUTH_PROVIDER = source.AUTH_PROVIDER
         AND target.AUTH_SUBJECT = source.AUTH_SUBJECT
       )
       WHEN MATCHED THEN UPDATE SET
         target.EMAIL = source.EMAIL,
         target.DISPLAY_NAME = source.DISPLAY_NAME,
         target.UPDATED_AT = SYSTIMESTAMP
       WHEN NOT MATCHED THEN INSERT
         (USER_ID, AUTH_PROVIDER, AUTH_SUBJECT, EMAIL, DISPLAY_NAME)
       VALUES
         (source.USER_ID, source.AUTH_PROVIDER, source.AUTH_SUBJECT, source.EMAIL, source.DISPLAY_NAME)`,
      { userId, ...identity, displayName: identity.displayName ?? null },
    );

    return selectByIdentity(connection, identity.provider, identity.subject);
  });
}

export async function findUserByIdentity(provider: string, subject: string) {
  const identity = authIdentitySchema.pick({ provider: true, subject: true }).parse({
    provider,
    subject,
  });

  return withConnection(async (connection) => {
    try {
      return await selectByIdentity(connection, identity.provider, identity.subject);
    } catch (error) {
      if (error instanceof UserNotFoundError) return null;
      throw error;
    }
  });
}

async function selectByIdentity(
  connection: oracledb.Connection,
  provider: string,
  subject: string,
) {
  const result = await connection.execute<UserRow>(
    `SELECT USER_ID AS "userId",
            EMAIL AS "email",
            DISPLAY_NAME AS "displayName",
            STATUS AS "status"
     FROM APP_USERS
     WHERE AUTH_PROVIDER = :provider
       AND AUTH_SUBJECT = :subject`,
    { provider, subject },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const row = result.rows?.[0];
  if (!row) throw new UserNotFoundError();
  return row;
}

class UserNotFoundError extends Error {}
