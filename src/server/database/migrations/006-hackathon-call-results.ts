import type { Migration } from "./types";

const change = (sql: string) => ({ sql, ignoreOracleErrors: [1430, 2264, 2275, 2443] });

export const hackathonCallResultsMigration: Migration = {
  version: 6,
  name: "hackathon_call_results",
  statements: [
    {
      sql: `UPDATE PROVIDER_LOCATIONS
            SET PHONE_E164 = CASE LOCATION_ID
              WHEN 'loc-lakeview-dental' THEN '+19172082802'
              WHEN 'loc-north-branch-dental' THEN '+18327578013'
              WHEN 'loc-riverside-smile' THEN '+19172082802'
            END,
                UPDATED_AT = SYSTIMESTAMP
            WHERE LOCATION_ID IN (
              'loc-lakeview-dental',
              'loc-north-branch-dental',
              'loc-riverside-smile'
            )`,
    },
    change(`ALTER TABLE OUTREACH_ATTEMPTS ADD (
      RESULT_JSON CLOB
    )`),
    change(`ALTER TABLE OUTREACH_ATTEMPTS ADD CONSTRAINT CK_OUTREACH_RESULT_JSON
      CHECK (RESULT_JSON IS JSON)`),
    change(`ALTER TABLE APPOINTMENT_OPTIONS DROP CONSTRAINT CK_APPT_OPT_SOURCE`),
    change(`ALTER TABLE APPOINTMENT_OPTIONS ADD CONSTRAINT CK_APPT_OPT_SOURCE
      CHECK (SOURCE IN ('CATALOG', 'DEMO', 'VAPI'))`),
  ],
};
