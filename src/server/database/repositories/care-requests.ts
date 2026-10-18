import "server-only";

import oracledb from "oracledb";

import { canonicalVisitType, type Slot } from "@/lib/careway/model";
import { withTransaction } from "@/server/database/transaction";

type ProviderCandidate = {
  locationId: string;
  typeId: string;
  providerName: string;
  rating: number | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  region: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  durationMinutes: number;
  selfPayMin: number | null;
  selfPayMax: number | null;
  currency: string;
};

type RequestRow = {
  requestId: string;
  visitType: string;
  postalCode: string | null;
  radiusMiles: number | null;
  timePreference: string | null;
  paymentPreference: "INSURANCE" | "SELF" | "LATER" | null;
  status: string;
};

type OptionRow = {
  optionId: string;
  locationId: string;
  phoneE164: string | null;
  offeredStart: Date;
  offeredEnd: Date | null;
  estimateMin: number | null;
  estimateMax: number | null;
  providerName: string;
  rating: number | null;
  distanceMiles: number | null;
  addressLine1: string;
  city: string;
  region: string;
  postalCode: string;
  durationMinutes: number | null;
  visitType: string;
};

export type CareRequestSearch = {
  userId: string;
  requestId?: string;
  visitType: string;
  postalCode: string;
  radiusMiles: number;
  timePreference: string;
  paymentPreference: "INSURANCE" | "SELF" | "LATER" | null;
  conversationId?: string | null;
};

const zipCentroids: Record<string, [number, number]> = {
  "10001": [40.7506, -73.9971],
  "60601": [41.886, -87.618],
  "60610": [41.9045, -87.634],
  "60611": [41.8947, -87.619],
  "60613": [41.9536, -87.654],
  "60614": [41.9224, -87.6493],
  "60618": [41.9467, -87.702],
  "60622": [41.9027, -87.68],
  "60647": [41.921, -87.7],
  "60657": [41.9403, -87.6536],
  "94105": [37.789, -122.394],
};

export async function syncCareRequest(input: CareRequestSearch) {
  const visitType = canonicalVisitType(input.visitType);
  const periods = timePeriods(input.timePreference);

  return withTransaction(async (connection) => {
    const type = await connection.execute<{ typeId: string }>(
      `SELECT TYPE_ID AS "typeId"
       FROM APPOINTMENT_TYPES
       WHERE SLUG = :visitType AND IS_ACTIVE = 1`,
      { visitType },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const typeId = type.rows?.[0]?.typeId;
    if (!typeId) throw new Error(`No active appointment type for ${visitType}`);

    const requestId = await openRequestId(connection, input.userId, input.requestId);
    await connection.execute(
      `MERGE INTO CARE_REQUESTS target
       USING (
         SELECT :requestId REQUEST_ID,
                :userId USER_ID,
                :typeId TYPE_ID,
                :postalCode SEARCH_POSTAL_CODE,
                :radiusMiles SEARCH_RADIUS_MILES,
                :timePreference TIME_PREFERENCE,
                :paymentPreference PAYMENT_PREFERENCE,
                :conversationId SOURCE_CONVERSATION_ID
         FROM DUAL
       ) source
       ON (target.REQUEST_ID = source.REQUEST_ID AND target.USER_ID = source.USER_ID)
       WHEN MATCHED THEN UPDATE SET
         target.TYPE_ID = source.TYPE_ID,
         target.SEARCH_POSTAL_CODE = source.SEARCH_POSTAL_CODE,
         target.SEARCH_RADIUS_MILES = source.SEARCH_RADIUS_MILES,
         target.TIME_PREFERENCE = source.TIME_PREFERENCE,
         target.PAYMENT_PREFERENCE = source.PAYMENT_PREFERENCE,
         target.SOURCE_CONVERSATION_ID = source.SOURCE_CONVERSATION_ID,
         target.STATUS = 'OPTIONS_READY',
         target.UPDATED_AT = SYSTIMESTAMP
       WHEN NOT MATCHED THEN INSERT (
         REQUEST_ID, USER_ID, TYPE_ID, SEARCH_POSTAL_CODE, SEARCH_RADIUS_MILES,
         TIME_PREFERENCE, PAYMENT_PREFERENCE, SOURCE_CONVERSATION_ID, STATUS
       ) VALUES (
         source.REQUEST_ID, source.USER_ID, source.TYPE_ID, source.SEARCH_POSTAL_CODE,
         source.SEARCH_RADIUS_MILES, source.TIME_PREFERENCE, source.PAYMENT_PREFERENCE,
         source.SOURCE_CONVERSATION_ID, 'OPTIONS_READY'
       )`,
      {
        requestId,
        userId: input.userId,
        typeId,
        postalCode: input.postalCode,
        radiusMiles: input.radiusMiles,
        timePreference: input.timePreference,
        paymentPreference: input.paymentPreference,
        conversationId: input.conversationId ?? null,
      },
    );

    await connection.execute(
      `UPDATE APPOINTMENT_OPTIONS
       SET STATUS = 'REPLACED', UPDATED_AT = SYSTIMESTAMP
       WHERE REQUEST_ID = :requestId AND STATUS = 'SHOWN'`,
      { requestId },
    );

    const candidates = await connection.execute<ProviderCandidate>(
      `SELECT location.LOCATION_ID AS "locationId",
              appointment_type.TYPE_ID AS "typeId",
              location.PROVIDER_NAME AS "providerName",
              location.RATING AS "rating",
              location.ADDRESS_LINE_1 AS "addressLine1",
              location.ADDRESS_LINE_2 AS "addressLine2",
              location.CITY AS "city",
              location.REGION AS "region",
              location.POSTAL_CODE AS "postalCode",
              location.LATITUDE AS "latitude",
              location.LONGITUDE AS "longitude",
              service.DURATION_MINUTES AS "durationMinutes",
              service.SELF_PAY_MIN AS "selfPayMin",
              service.SELF_PAY_MAX AS "selfPayMax",
              service.CURRENCY AS "currency"
       FROM PROVIDER_SERVICES service
       JOIN PROVIDER_LOCATIONS location ON location.LOCATION_ID = service.LOCATION_ID
       JOIN APPOINTMENT_TYPES appointment_type ON appointment_type.TYPE_ID = service.TYPE_ID
       WHERE service.IS_ACTIVE = 1
         AND location.IS_ACTIVE = 1
         AND appointment_type.IS_ACTIVE = 1
         AND appointment_type.SLUG = :visitType
         AND NVL(location.RATING, 0) >= 0
       ORDER BY location.RATING DESC NULLS LAST, location.PROVIDER_NAME`,
      { visitType },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    const origin = zipCentroids[input.postalCode];
    const matches = (candidates.rows ?? []).flatMap((row, index) => {
      const distance = origin && row.latitude != null && row.longitude != null
        ? milesBetween(origin[0], origin[1], row.latitude, row.longitude)
        : null;
      if (distance != null && distance > input.radiusMiles) return [];
      return periods.map((period) => ({ row, period, distance, index }));
    });

    for (const match of matches) {
      const start = offeredTime(match.index, match.period);
      const end = new Date(start.getTime() + match.row.durationMinutes * 60_000);
      await connection.execute(
        `INSERT INTO APPOINTMENT_OPTIONS (
           OPTION_ID, REQUEST_ID, LOCATION_ID, TYPE_ID, OFFERED_START, OFFERED_END,
           ESTIMATE_MIN, ESTIMATE_MAX, CURRENCY, PROVIDER_NAME, RATING, DISTANCE_MILES,
           ADDRESS_LINE_1, ADDRESS_LINE_2, CITY, REGION, POSTAL_CODE, SOURCE, STATUS
         ) VALUES (
           :optionId, :requestId, :locationId, :typeId, :offeredStart, :offeredEnd,
           :estimateMin, :estimateMax, :currency, :providerName, :rating, :distanceMiles,
           :addressLine1, :addressLine2, :city, :region, :postalCode, 'CATALOG', 'SHOWN'
         )`,
        {
          optionId: crypto.randomUUID(),
          requestId,
          locationId: match.row.locationId,
          typeId: match.row.typeId,
          offeredStart: start,
          offeredEnd: end,
          estimateMin: match.row.selfPayMin,
          estimateMax: match.row.selfPayMax,
          currency: match.row.currency || "USD",
          providerName: match.row.providerName,
          rating: match.row.rating,
          distanceMiles: match.distance == null ? null : Math.round(match.distance * 10) / 10,
          addressLine1: match.row.addressLine1,
          addressLine2: match.row.addressLine2,
          city: match.row.city,
          region: match.row.region,
          postalCode: match.row.postalCode,
        },
      );
    }

    return loadCareRequest(connection, input.userId, requestId);
  });
}

export async function findOpenCareRequest(userId: string) {
  return withTransaction(async (connection) => {
    const open = await connection.execute<{ requestId: string }>(
      `SELECT REQUEST_ID AS "requestId"
       FROM CARE_REQUESTS
       WHERE USER_ID = :userId
         AND STATUS IN ('DRAFT', 'SEARCHING', 'OPTIONS_READY')
       ORDER BY UPDATED_AT DESC
       FETCH FIRST 1 ROW ONLY`,
      { userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const requestId = open.rows?.[0]?.requestId;
    return requestId ? loadCareRequest(connection, userId, requestId) : null;
  });
}

export async function findCareRequest(userId: string, requestId: string) {
  return withTransaction((connection) => loadCareRequest(connection, userId, requestId));
}

async function openRequestId(
  connection: oracledb.Connection,
  userId: string,
  requestedId: string | undefined,
) {
  if (requestedId) {
    const owned = await connection.execute<{ requestId: string }>(
      `SELECT REQUEST_ID AS "requestId"
       FROM CARE_REQUESTS
       WHERE REQUEST_ID = :requestId AND USER_ID = :userId`,
      { requestId: requestedId, userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    if (owned.rows?.[0]?.requestId) return owned.rows[0].requestId;
  }

  const open = await connection.execute<{ requestId: string }>(
    `SELECT REQUEST_ID AS "requestId"
     FROM CARE_REQUESTS
     WHERE USER_ID = :userId
       AND STATUS IN ('DRAFT', 'SEARCHING', 'OPTIONS_READY')
     ORDER BY UPDATED_AT DESC
     FETCH FIRST 1 ROW ONLY`,
    { userId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  return open.rows?.[0]?.requestId ?? crypto.randomUUID();
}

async function loadCareRequest(connection: oracledb.Connection, userId: string, requestId: string) {
  const request = await connection.execute<RequestRow>(
    `SELECT request.REQUEST_ID AS "requestId",
            appointment_type.SLUG AS "visitType",
            request.SEARCH_POSTAL_CODE AS "postalCode",
            request.SEARCH_RADIUS_MILES AS "radiusMiles",
            request.TIME_PREFERENCE AS "timePreference",
            request.PAYMENT_PREFERENCE AS "paymentPreference",
            request.STATUS AS "status"
     FROM CARE_REQUESTS request
     JOIN APPOINTMENT_TYPES appointment_type ON appointment_type.TYPE_ID = request.TYPE_ID
     WHERE request.REQUEST_ID = :requestId
       AND request.USER_ID = :userId`,
    { requestId, userId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const row = request.rows?.[0];
  if (!row) throw new Error("Care request was not found");

  const options = await connection.execute<OptionRow>(
    `SELECT option_row.OPTION_ID AS "optionId",
            option_row.LOCATION_ID AS "locationId",
            location.PHONE_E164 AS "phoneE164",
            option_row.OFFERED_START AS "offeredStart",
            option_row.OFFERED_END AS "offeredEnd",
            option_row.ESTIMATE_MIN AS "estimateMin",
            option_row.ESTIMATE_MAX AS "estimateMax",
            option_row.PROVIDER_NAME AS "providerName",
            option_row.RATING AS "rating",
            option_row.DISTANCE_MILES AS "distanceMiles",
            option_row.ADDRESS_LINE_1 AS "addressLine1",
            option_row.CITY AS "city",
            option_row.REGION AS "region",
            option_row.POSTAL_CODE AS "postalCode",
            service.DURATION_MINUTES AS "durationMinutes",
            appointment_type.SLUG AS "visitType"
     FROM APPOINTMENT_OPTIONS option_row
     JOIN PROVIDER_LOCATIONS location ON location.LOCATION_ID = option_row.LOCATION_ID
     JOIN APPOINTMENT_TYPES appointment_type ON appointment_type.TYPE_ID = option_row.TYPE_ID
     LEFT JOIN PROVIDER_SERVICES service
       ON service.LOCATION_ID = option_row.LOCATION_ID
      AND service.TYPE_ID = option_row.TYPE_ID
     WHERE option_row.REQUEST_ID = :requestId
       AND option_row.STATUS = 'SHOWN'
     ORDER BY option_row.OFFERED_START`,
    { requestId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );

  return {
    requestId: row.requestId,
    visitType: row.visitType,
    postalCode: row.postalCode,
    radiusMiles: row.radiusMiles ?? 5,
    timePreference: row.timePreference,
    paymentPreference: row.paymentPreference,
    status: row.status,
    options: (options.rows ?? []).map(slotFromOption),
  };
}

function slotFromOption(row: OptionRow): Slot {
  const start = new Date(row.offeredStart);
  const end = row.offeredEnd ? new Date(row.offeredEnd) : new Date(start.getTime() + 45 * 60_000);
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/Chicago" }).format(start));
  return {
    id: row.optionId,
    locationId: row.locationId,
    phone: row.phoneE164 ?? "",
    visitType: row.visitType,
    provider: row.providerName,
    dateLabel: new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" }).format(start),
    longDate: new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "America/Chicago" }).format(start),
    timeLabel: formatClock(start),
    endLabel: formatClock(end),
    duration: `${row.durationMinutes ?? 45} min`,
    address: row.addressLine1,
    cityLine: `${row.city}, ${row.region} ${row.postalCode}`,
    reference: `CW-${row.optionId.slice(0, 6).toUpperCase()}`,
    estimate: formatEstimate(row.estimateMin, row.estimateMax),
    distance: row.distanceMiles == null ? "Distance unavailable" : `${row.distanceMiles} miles`,
    rating: row.rating == null ? "New" : row.rating.toFixed(1),
    period: hour < 12 ? "morning" : "afternoon",
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function formatClock(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  }).format(value);
}

export async function saveOfficeOutreach(input: {
  userId: string;
  requestId: string;
  destination: string;
  status: "READY_FOR_CALL" | "CALLING" | "COMPLETED" | "FAILED";
  externalReference?: string | null;
  summary: string;
}) {
  return withTransaction(async (connection) => {
    const attemptId = crypto.randomUUID();
    const inserted = await connection.execute(
      `INSERT INTO OUTREACH_ATTEMPTS (
         ATTEMPT_ID, REQUEST_ID, CHANNEL, DESTINATION, STATUS, EXTERNAL_REFERENCE, RESULT_SUMMARY
       )
       SELECT :attemptId, request.REQUEST_ID, 'PHONE', :destination, :status, :externalReference, :summary
       FROM CARE_REQUESTS request
       WHERE request.REQUEST_ID = :requestId
         AND request.USER_ID = :userId`,
      {
        attemptId,
        destination: input.destination.slice(0, 320),
        status: input.status,
        externalReference: input.externalReference ?? null,
        summary: input.summary.slice(0, 500),
        requestId: input.requestId,
        userId: input.userId,
      },
    );
    if ((inserted.rowsAffected ?? 0) < 1) throw new Error("The care request could not be prepared for a call.");
    return attemptId;
  });
}

export async function updateOfficeOutreach(input: {
  userId: string;
  attemptId: string;
  status: "CALLING" | "COMPLETED" | "FAILED";
  externalReference?: string | null;
  summary: string;
  resultJson?: string | null;
}) {
  return withTransaction(async (connection) => {
    const updated = await connection.execute(
      `UPDATE OUTREACH_ATTEMPTS attempt
       SET STATUS = :status,
           EXTERNAL_REFERENCE = :externalReference,
           RESULT_SUMMARY = :summary,
           RESULT_JSON = COALESCE(:resultJson, RESULT_JSON)
       WHERE attempt.ATTEMPT_ID = :attemptId
         AND EXISTS (
           SELECT 1 FROM CARE_REQUESTS request
           WHERE request.REQUEST_ID = attempt.REQUEST_ID
             AND request.USER_ID = :userId
         )`,
      {
        status: input.status,
        externalReference: input.externalReference ?? null,
        summary: input.summary.slice(0, 500),
        resultJson: { val: input.resultJson ?? null, type: oracledb.DB_TYPE_CLOB },
        attemptId: input.attemptId,
        userId: input.userId,
      },
    );
    return (updated.rowsAffected ?? 0) > 0;
  });
}

export async function saveVapiAppointmentOptions(input: {
  userId: string;
  requestId: string;
  locationId: string;
  times: Array<{ label: string; startIso: string | null; endIso: string | null }>;
  source?: "VAPI" | "DEMO";
}) {
  const sourceName = input.source ?? "VAPI";
  return withTransaction(async (connection) => {
    const source = await connection.execute<ProviderCandidate & { requestId: string }>(
      `SELECT request.REQUEST_ID AS "requestId",
              request.TYPE_ID AS "typeId",
              location.LOCATION_ID AS "locationId",
              location.PROVIDER_NAME AS "providerName",
              location.RATING AS "rating",
              location.ADDRESS_LINE_1 AS "addressLine1",
              location.ADDRESS_LINE_2 AS "addressLine2",
              location.CITY AS "city",
              location.REGION AS "region",
              location.POSTAL_CODE AS "postalCode",
              service.DURATION_MINUTES AS "durationMinutes",
              service.SELF_PAY_MIN AS "selfPayMin",
              service.SELF_PAY_MAX AS "selfPayMax",
              service.CURRENCY AS "currency"
       FROM CARE_REQUESTS request
       JOIN PROVIDER_SERVICES service
         ON service.TYPE_ID = request.TYPE_ID
        AND service.LOCATION_ID = :locationId
       JOIN PROVIDER_LOCATIONS location ON location.LOCATION_ID = service.LOCATION_ID
       WHERE request.REQUEST_ID = :requestId
         AND request.USER_ID = :userId
         AND service.IS_ACTIVE = 1
         AND location.IS_ACTIVE = 1`,
      { requestId: input.requestId, locationId: input.locationId, userId: input.userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const row = source.rows?.[0];
    if (!row) throw new Error("The selected office is not linked to this care request.");

    await connection.execute(
      `UPDATE APPOINTMENT_OPTIONS
       SET STATUS = 'REPLACED', UPDATED_AT = SYSTIMESTAMP
       WHERE REQUEST_ID = :requestId
         AND LOCATION_ID = :locationId
         AND SOURCE = :sourceName
         AND STATUS = 'SHOWN'`,
      { requestId: input.requestId, locationId: input.locationId, sourceName },
    );

    const saved: Array<{ optionId: string; label: string; startIso: string; endIso: string | null }> = [];
    for (const time of input.times) {
      if (!time.startIso) continue;
      const start = new Date(time.startIso);
      if (!Number.isFinite(start.getTime())) continue;
      const end = time.endIso ? new Date(time.endIso) : new Date(start.getTime() + row.durationMinutes * 60_000);
      const optionId = crypto.randomUUID();
      await connection.execute(
        `INSERT INTO APPOINTMENT_OPTIONS (
           OPTION_ID, REQUEST_ID, LOCATION_ID, TYPE_ID, OFFERED_START, OFFERED_END,
           ESTIMATE_MIN, ESTIMATE_MAX, CURRENCY, PROVIDER_NAME, RATING,
           ADDRESS_LINE_1, ADDRESS_LINE_2, CITY, REGION, POSTAL_CODE, SOURCE, STATUS
         ) VALUES (
           :optionId, :requestId, :locationId, :typeId, :offeredStart, :offeredEnd,
           :estimateMin, :estimateMax, :currency, :providerName, :rating,
           :addressLine1, :addressLine2, :city, :region, :postalCode, :sourceName, 'SHOWN'
         )`,
        {
          optionId,
          requestId: input.requestId,
          locationId: row.locationId,
          typeId: row.typeId,
          offeredStart: start,
          offeredEnd: end,
          estimateMin: row.selfPayMin,
          estimateMax: row.selfPayMax,
          currency: row.currency || "USD",
          providerName: row.providerName,
          rating: row.rating,
          addressLine1: row.addressLine1,
          addressLine2: row.addressLine2,
          city: row.city,
          region: row.region,
          postalCode: row.postalCode,
          sourceName,
        },
      );
      saved.push({ optionId, label: time.label, startIso: start.toISOString(), endIso: end.toISOString() });
    }
    return saved;
  });
}

function formatEstimate(minimum: number | null, maximum: number | null) {
  if (minimum == null) return "price unavailable";
  if (maximum == null || maximum === minimum) return `$${minimum}`;
  return `$${minimum}–$${maximum}`;
}

function timePeriods(preference: string): Array<"morning" | "afternoon"> {
  const value = preference.toLowerCase();
  if (value.includes("morning")) return ["morning"];
  if (value.includes("afternoon")) return ["afternoon"];
  return ["morning", "afternoon"];
}

function offeredTime(index: number, period: "morning" | "afternoon") {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1 + index);
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() + 1);
  const hour = period === "morning" ? 14 : 19;
  date.setUTCHours(hour, period === "morning" ? 0 : 15, 0, 0);
  return date;
}

function milesBetween(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radius = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(a));
}
