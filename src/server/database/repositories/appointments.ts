import "server-only";

import oracledb from "oracledb";

import {
  type Appointment,
  type AppointmentStatus,
  type Slot,
} from "@/lib/careway/model";
import { withTransaction } from "@/server/database/transaction";

type AppointmentRow = {
  appointmentId: string;
  status: string;
  confirmationReference: string | null;
  simulated: number;
  optionId: string;
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

const appointmentSelect = `SELECT appointment.APPOINTMENT_ID AS "appointmentId",
       appointment.STATUS AS "status",
       appointment.CONFIRMATION_REFERENCE AS "confirmationReference",
       appointment.SIMULATED AS "simulated",
       option_row.OPTION_ID AS "optionId",
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
FROM APPOINTMENTS appointment
JOIN APPOINTMENT_OPTIONS option_row ON option_row.OPTION_ID = appointment.OPTION_ID
JOIN APPOINTMENT_TYPES appointment_type ON appointment_type.TYPE_ID = appointment.TYPE_ID
LEFT JOIN PROVIDER_SERVICES service
  ON service.LOCATION_ID = appointment.LOCATION_ID
 AND service.TYPE_ID = appointment.TYPE_ID`;

export async function listAppointments(userId: string) {
  return withTransaction(async (connection) => {
    const result = await connection.execute<AppointmentRow>(
      `${appointmentSelect}
       WHERE appointment.USER_ID = :userId
       ORDER BY appointment.UPDATED_AT DESC`,
      { userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    return (result.rows ?? []).map(appointmentFromRow);
  });
}

export async function requestSavedAppointment(input: {
  userId: string;
  optionId: string;
  shareSms: boolean;
}) {
  return withTransaction(async (connection) => {
    const existing = await connection.execute<{ appointmentId: string }>(
      `SELECT APPOINTMENT_ID AS "appointmentId"
       FROM APPOINTMENTS
       WHERE USER_ID = :userId
         AND OPTION_ID = :optionId
         AND STATUS <> 'CANCELLED'
       ORDER BY UPDATED_AT DESC
       FETCH FIRST 1 ROW ONLY`,
      { userId: input.userId, optionId: input.optionId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const existingId = existing.rows?.[0]?.appointmentId;
    if (existingId) return loadAppointment(connection, input.userId, existingId);

    const appointmentId = crypto.randomUUID();
    const confirmationReference = `SIM-${appointmentId.slice(0, 6).toUpperCase()}`;
    const inserted = await connection.execute(
      `INSERT INTO APPOINTMENTS (
         APPOINTMENT_ID, USER_ID, REQUEST_ID, OPTION_ID, LOCATION_ID, TYPE_ID,
         SCHEDULED_START, SCHEDULED_END, STATUS, CONFIRMATION_REFERENCE,
         ESTIMATE_MIN, ESTIMATE_MAX, CURRENCY, NETWORK_STATE, SIMULATED
       )
       SELECT :appointmentId,
              request.USER_ID,
              option_row.REQUEST_ID,
              option_row.OPTION_ID,
              option_row.LOCATION_ID,
              option_row.TYPE_ID,
              option_row.OFFERED_START,
              option_row.OFFERED_END,
              'SIMULATED',
              :confirmationReference,
              option_row.ESTIMATE_MIN,
              option_row.ESTIMATE_MAX,
              option_row.CURRENCY,
              'UNKNOWN',
              1
       FROM APPOINTMENT_OPTIONS option_row
       JOIN CARE_REQUESTS request ON request.REQUEST_ID = option_row.REQUEST_ID
       WHERE option_row.OPTION_ID = :optionId
         AND request.USER_ID = :userId
         AND option_row.STATUS = 'SHOWN'`,
      {
        appointmentId,
        confirmationReference,
        optionId: input.optionId,
        userId: input.userId,
      },
    );
    if ((inserted.rowsAffected ?? 0) === 0) {
      throw new Error("That option is no longer on the saved shortlist. Search again and choose a current time.");
    }

    await connection.execute(
      `UPDATE APPOINTMENT_OPTIONS
       SET STATUS = 'SELECTED', UPDATED_AT = SYSTIMESTAMP
       WHERE OPTION_ID = :optionId AND STATUS = 'SHOWN'`,
      { optionId: input.optionId },
    );

    const request = await connection.execute<{ requestId: string; phone: string | null }>(
      `SELECT request.REQUEST_ID AS "requestId",
              profile.PHONE_E164 AS "phone"
       FROM APPOINTMENT_OPTIONS option_row
       JOIN CARE_REQUESTS request ON request.REQUEST_ID = option_row.REQUEST_ID
       LEFT JOIN PATIENT_PROFILES profile ON profile.USER_ID = request.USER_ID
       WHERE option_row.OPTION_ID = :optionId
         AND request.USER_ID = :userId`,
      { optionId: input.optionId, userId: input.userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );
    const linked = request.rows?.[0];
    await connection.execute(
      `INSERT INTO OUTREACH_ATTEMPTS (
         ATTEMPT_ID, REQUEST_ID, APPOINTMENT_ID, CHANNEL, STATUS, EXTERNAL_REFERENCE, RESULT_SUMMARY
       ) VALUES (
         :attemptId, :requestId, :appointmentId, 'WEB', 'SIMULATED', :confirmationReference,
         'No office was contacted. This request is a labeled simulation.'
       )`,
      {
        attemptId: crypto.randomUUID(),
        requestId: linked?.requestId ?? null,
        appointmentId,
        confirmationReference,
      },
    );
    if (input.shareSms) {
      await connection.execute(
        `INSERT INTO OUTREACH_ATTEMPTS (
           ATTEMPT_ID, REQUEST_ID, APPOINTMENT_ID, CHANNEL, DESTINATION, STATUS, RESULT_SUMMARY
         ) VALUES (
           :attemptId, :requestId, :appointmentId, 'SMS', :destination, 'SKIPPED',
           'SMS reminders were requested. No message was sent.'
         )`,
        {
          attemptId: crypto.randomUUID(),
          requestId: linked?.requestId ?? null,
          appointmentId,
          destination: linked?.phone ?? null,
        },
      );
    }

    return loadAppointment(connection, input.userId, appointmentId);
  });
}

export async function cancelSavedAppointment(userId: string, appointmentId: string) {
  return withTransaction(async (connection) => {
    const updated = await connection.execute(
      `UPDATE APPOINTMENTS
       SET STATUS = 'CANCELLED', UPDATED_AT = SYSTIMESTAMP
       WHERE APPOINTMENT_ID = :appointmentId
         AND USER_ID = :userId
         AND STATUS IN ('REQUESTED', 'CONFIRMED', 'SIMULATED')`,
      { appointmentId, userId },
    );
    if ((updated.rowsAffected ?? 0) === 0) {
      const current = await loadAppointment(connection, userId, appointmentId);
      if (current.status === "cancelled") return current;
      throw new Error("This appointment could not be cancelled.");
    }
    return loadAppointment(connection, userId, appointmentId);
  });
}

async function loadAppointment(connection: oracledb.Connection, userId: string, appointmentId: string) {
  const result = await connection.execute<AppointmentRow>(
    `${appointmentSelect}
     WHERE appointment.USER_ID = :userId
       AND appointment.APPOINTMENT_ID = :appointmentId`,
    { userId, appointmentId },
    { outFormat: oracledb.OUT_FORMAT_OBJECT },
  );
  const row = result.rows?.[0];
  if (!row) throw new Error("Appointment was not found");
  return appointmentFromRow(row);
}

function appointmentFromRow(row: AppointmentRow): Appointment {
  const slot = slotFromRow(row);
  return {
    ...slot,
    reference: row.confirmationReference || slot.reference,
    appointmentId: row.appointmentId,
    status: appointmentStatus(row.status),
    simulated: row.simulated !== 0,
  };
}

function slotFromRow(row: AppointmentRow): Slot {
  const start = new Date(row.offeredStart);
  const end = row.offeredEnd ? new Date(row.offeredEnd) : new Date(start.getTime() + 45 * 60_000);
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/Chicago" }).format(start));
  return {
    id: row.optionId,
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

function appointmentStatus(value: string): AppointmentStatus {
  const status = value.toLowerCase();
  if (status === "requested" || status === "confirmed" || status === "failed" || status === "cancelled" || status === "simulated") {
    return status;
  }
  return "simulated";
}

function formatClock(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  }).format(value);
}

function formatEstimate(minimum: number | null, maximum: number | null) {
  if (minimum == null) return "price unavailable";
  if (maximum == null || maximum === minimum) return `$${minimum}`;
  return `$${minimum}–$${maximum}`;
}
