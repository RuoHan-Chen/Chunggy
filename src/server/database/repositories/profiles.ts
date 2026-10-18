import "server-only";

import oracledb from "oracledb";

import { withConnection, withTransaction } from "@/server/database/transaction";
import { patientProfileSchema } from "@/server/database/validation";

type ProfileRow = {
  userId: string;
  fullName: string;
  phoneE164: string;
  dateOfBirth: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string;
  countryCode: string;
  preferredLanguage: string;
  paymentPreference: "INSURANCE" | "SELF" | "LATER";
  onboardingStatus: "NOT_STARTED" | "DEFERRED" | "COMPLETE";
};

export type PatientProfileRecord = ProfileRow;

export async function savePatientProfile(input: unknown): Promise<ProfileRow> {
  const profile = patientProfileSchema.parse(input);

  return withTransaction(async (connection) => {
    await connection.execute(
      `MERGE INTO PATIENT_PROFILES target
       USING (
         SELECT :userId USER_ID,
                :fullName FULL_NAME,
                :phoneE164 PHONE_E164,
                TO_DATE(:dateOfBirth, 'YYYY-MM-DD') DATE_OF_BIRTH,
                :addressLine1 ADDRESS_LINE_1,
                :addressLine2 ADDRESS_LINE_2,
                :city CITY,
                :region REGION,
                :postalCode POSTAL_CODE,
                :countryCode COUNTRY_CODE,
                :preferredLanguage PREFERRED_LANGUAGE,
                :paymentPreference PAYMENT_PREFERENCE,
                :onboardingStatus ONBOARDING_STATUS
         FROM DUAL
       ) source
       ON (target.USER_ID = source.USER_ID)
       WHEN MATCHED THEN UPDATE SET
         target.FULL_NAME = source.FULL_NAME,
         target.PHONE_E164 = source.PHONE_E164,
         target.DATE_OF_BIRTH = source.DATE_OF_BIRTH,
         target.ADDRESS_LINE_1 = source.ADDRESS_LINE_1,
         target.ADDRESS_LINE_2 = source.ADDRESS_LINE_2,
         target.CITY = source.CITY,
         target.REGION = source.REGION,
         target.POSTAL_CODE = source.POSTAL_CODE,
         target.COUNTRY_CODE = source.COUNTRY_CODE,
         target.PREFERRED_LANGUAGE = source.PREFERRED_LANGUAGE,
         target.PAYMENT_PREFERENCE = source.PAYMENT_PREFERENCE,
         target.ONBOARDING_STATUS = source.ONBOARDING_STATUS,
         target.ONBOARDING_COMPLETED_AT = CASE
           WHEN source.ONBOARDING_STATUS = 'COMPLETE' THEN COALESCE(target.ONBOARDING_COMPLETED_AT, SYSTIMESTAMP)
           ELSE NULL
         END,
         target.UPDATED_AT = SYSTIMESTAMP
       WHEN NOT MATCHED THEN INSERT
         (USER_ID, FULL_NAME, PHONE_E164, DATE_OF_BIRTH, ADDRESS_LINE_1, ADDRESS_LINE_2, CITY, REGION, POSTAL_CODE, COUNTRY_CODE, PREFERRED_LANGUAGE, PAYMENT_PREFERENCE, ONBOARDING_STATUS, ONBOARDING_COMPLETED_AT)
       VALUES
         (source.USER_ID, source.FULL_NAME, source.PHONE_E164, source.DATE_OF_BIRTH, source.ADDRESS_LINE_1, source.ADDRESS_LINE_2, source.CITY, source.REGION, source.POSTAL_CODE, source.COUNTRY_CODE, source.PREFERRED_LANGUAGE, source.PAYMENT_PREFERENCE, source.ONBOARDING_STATUS,
          CASE WHEN source.ONBOARDING_STATUS = 'COMPLETE' THEN SYSTIMESTAMP ELSE NULL END)`,
      {
        ...profile,
        addressLine1: profile.addressLine1 ?? null,
        addressLine2: profile.addressLine2 ?? null,
        city: profile.city ?? null,
        region: profile.region ?? null,
      },
    );

    const saved = await selectProfile(connection, profile.userId);
    if (!saved) throw new Error("Patient profile was not saved");
    return saved;
  });
}

export async function findPatientProfile(userId: string) {
  const validUserId = patientProfileSchema.shape.userId.parse(userId);

  return withConnection(async (connection) => selectProfile(connection, validUserId));
}

async function selectProfile(connection: oracledb.Connection, userId: string) {
  const result = await connection.execute<ProfileRow>(
    `SELECT USER_ID AS "userId",
            FULL_NAME AS "fullName",
            PHONE_E164 AS "phoneE164",
            TO_CHAR(DATE_OF_BIRTH, 'YYYY-MM-DD') AS "dateOfBirth",
            ADDRESS_LINE_1 AS "addressLine1",
            ADDRESS_LINE_2 AS "addressLine2",
            CITY AS "city",
            REGION AS "region",
            POSTAL_CODE AS "postalCode",
            COUNTRY_CODE AS "countryCode",
            PREFERRED_LANGUAGE AS "preferredLanguage",
            PAYMENT_PREFERENCE AS "paymentPreference",
            ONBOARDING_STATUS AS "onboardingStatus"
     FROM PATIENT_PROFILES
     WHERE USER_ID = :userId`,
    { userId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );

  return result.rows?.[0] ?? null;
}
