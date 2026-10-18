import "server-only";

import oracledb from "oracledb";

import { withConnection } from "@/server/database/transaction";
import { providerSearchSchema } from "@/server/database/validation";

type ProviderServiceRow = {
  locationId: string;
  providerName: string;
  rating: number | null;
  addressLine1: string;
  city: string;
  region: string;
  postalCode: string;
  appointmentType: string;
  displayName: string;
  durationMinutes: number;
  selfPayMin: number | null;
  selfPayMax: number | null;
  currency: string;
};

export type ProviderServiceRecord = ProviderServiceRow;

export async function listProviderServices(input: unknown) {
  const search = providerSearchSchema.parse(input);

  return withConnection(async (connection) => {
    const result = await connection.execute<ProviderServiceRow>(
      `SELECT location.LOCATION_ID AS "locationId",
              location.PROVIDER_NAME AS "providerName",
              location.RATING AS "rating",
              location.ADDRESS_LINE_1 AS "addressLine1",
              location.CITY AS "city",
              location.REGION AS "region",
              location.POSTAL_CODE AS "postalCode",
              appointment_type.SLUG AS "appointmentType",
              appointment_type.DISPLAY_NAME AS "displayName",
              service.DURATION_MINUTES AS "durationMinutes",
              service.SELF_PAY_MIN AS "selfPayMin",
              service.SELF_PAY_MAX AS "selfPayMax",
              service.CURRENCY AS "currency"
       FROM PROVIDER_SERVICES service
       JOIN PROVIDER_LOCATIONS location
         ON location.LOCATION_ID = service.LOCATION_ID
       JOIN APPOINTMENT_TYPES appointment_type
         ON appointment_type.TYPE_ID = service.TYPE_ID
       WHERE service.IS_ACTIVE = 1
         AND location.IS_ACTIVE = 1
         AND appointment_type.IS_ACTIVE = 1
         AND appointment_type.SLUG = :appointmentType
         AND NVL(location.RATING, 0) >= :minimumRating
       ORDER BY location.RATING DESC NULLS LAST, location.PROVIDER_NAME
       FETCH FIRST :limit ROWS ONLY`,
      search,
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    return result.rows ?? [];
  });
}
