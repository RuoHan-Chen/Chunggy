import "server-only";

import oracledb from "oracledb";

import { withConnection } from "@/server/database/transaction";

const queries = {
  APP_USERS: `SELECT USER_ID AS "userId",
                     EMAIL AS "email",
                     DISPLAY_NAME AS "displayName",
                     STATUS AS "status",
                     AUTH_PROVIDER AS "authProvider",
                     TO_CHAR(UPDATED_AT, 'YYYY-MM-DD HH24:MI') AS "updatedAt"
              FROM APP_USERS
              ORDER BY UPDATED_AT DESC
              FETCH FIRST 25 ROWS ONLY`,
  PATIENT_PROFILES: `SELECT USER_ID AS "userId",
                            FULL_NAME AS "fullName",
                            PHONE_E164 AS "phone",
                            TO_CHAR(DATE_OF_BIRTH, 'YYYY-MM-DD') AS "dateOfBirth",
                            POSTAL_CODE AS "postalCode",
                            PAYMENT_PREFERENCE AS "payment",
                            ONBOARDING_STATUS AS "onboarding",
                            TO_CHAR(UPDATED_AT, 'YYYY-MM-DD HH24:MI') AS "updatedAt"
                     FROM PATIENT_PROFILES
                     ORDER BY UPDATED_AT DESC
                     FETCH FIRST 25 ROWS ONLY`,
  INSURANCE_POLICIES: `SELECT POLICY_ID AS "policyId",
                              USER_ID AS "userId",
                              PAYER_NAME AS "payer",
                              PLAN_NAME AS "plan",
                              MEMBER_ID AS "memberId",
                              VERIFICATION_STATUS AS "verification",
                              IS_ACTIVE AS "active",
                              TO_CHAR(UPDATED_AT, 'YYYY-MM-DD HH24:MI') AS "updatedAt"
                       FROM INSURANCE_POLICIES
                       ORDER BY UPDATED_AT DESC
                       FETCH FIRST 25 ROWS ONLY`,
  APPOINTMENT_TYPES: `SELECT TYPE_ID AS "typeId",
                             SLUG AS "slug",
                             DISPLAY_NAME AS "displayName",
                             SPECIALTY AS "specialty",
                             DEFAULT_DURATION_MINUTES AS "durationMinutes",
                             IS_ACTIVE AS "active"
                      FROM APPOINTMENT_TYPES
                      ORDER BY SLUG
                      FETCH FIRST 25 ROWS ONLY`,
  PROVIDER_LOCATIONS: `SELECT LOCATION_ID AS "locationId",
                              PROVIDER_NAME AS "provider",
                              CITY AS "city",
                              REGION AS "region",
                              POSTAL_CODE AS "postalCode",
                              RATING AS "rating",
                              IS_ACTIVE AS "active"
                       FROM PROVIDER_LOCATIONS
                       ORDER BY PROVIDER_NAME
                       FETCH FIRST 25 ROWS ONLY`,
  PROVIDER_SERVICES: `SELECT LOCATION_ID AS "locationId",
                             TYPE_ID AS "typeId",
                             DURATION_MINUTES AS "durationMinutes",
                             SELF_PAY_MIN AS "selfPayMin",
                             SELF_PAY_MAX AS "selfPayMax",
                             CURRENCY AS "currency",
                             IS_ACTIVE AS "active"
                      FROM PROVIDER_SERVICES
                      ORDER BY LOCATION_ID, TYPE_ID
                      FETCH FIRST 25 ROWS ONLY`,
} as const;

const counts = {
  APP_USERS: `SELECT COUNT(*) AS "count" FROM APP_USERS`,
  PATIENT_PROFILES: `SELECT COUNT(*) AS "count" FROM PATIENT_PROFILES`,
  INSURANCE_POLICIES: `SELECT COUNT(*) AS "count" FROM INSURANCE_POLICIES`,
  APPOINTMENT_TYPES: `SELECT COUNT(*) AS "count" FROM APPOINTMENT_TYPES`,
  PROVIDER_LOCATIONS: `SELECT COUNT(*) AS "count" FROM PROVIDER_LOCATIONS`,
  PROVIDER_SERVICES: `SELECT COUNT(*) AS "count" FROM PROVIDER_SERVICES`,
} as const;

export type FoundationTable = keyof typeof queries;

export type FoundationTablePreview = {
  table: FoundationTable;
  count: number;
  columns: string[];
  rows: string[][];
};

const columns: Record<FoundationTable, string[]> = {
  APP_USERS: ["userId", "email", "displayName", "status", "authProvider", "updatedAt"],
  PATIENT_PROFILES: ["userId", "fullName", "phone", "dateOfBirth", "postalCode", "payment", "onboarding", "updatedAt"],
  INSURANCE_POLICIES: ["policyId", "userId", "payer", "plan", "memberId", "verification", "active", "updatedAt"],
  APPOINTMENT_TYPES: ["typeId", "slug", "displayName", "specialty", "durationMinutes", "active"],
  PROVIDER_LOCATIONS: ["locationId", "provider", "city", "region", "postalCode", "rating", "active"],
  PROVIDER_SERVICES: ["locationId", "typeId", "durationMinutes", "selfPayMin", "selfPayMax", "currency", "active"],
};

export async function readFoundationTables(): Promise<FoundationTablePreview[]> {
  return withConnection(async (connection) => {
    const tables = Object.keys(queries) as FoundationTable[];
    const previews: FoundationTablePreview[] = [];

    for (const table of tables) {
      const countResult = await connection.execute<{ count: number }>(
        counts[table],
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      const rowResult = await connection.execute<Record<string, unknown>>(
        queries[table],
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT },
      );
      const fields = columns[table];
      previews.push({
        table,
        count: Number(countResult.rows?.[0]?.count ?? 0),
        columns: fields,
        rows: (rowResult.rows ?? []).map((row) => fields.map((field) => cell(row[field]))),
      });
    }

    return previews;
  });
}

function cell(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
