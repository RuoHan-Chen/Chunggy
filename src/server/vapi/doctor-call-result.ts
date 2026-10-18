import { z } from "zod";

const timeSchema = z.union([
  z.string().trim().min(1).max(100).transform((label) => ({
    label,
    startIso: resolveAppointmentTimeLabel(label),
    endIso: null,
  })),
  z.object({
    label: z.string().trim().min(1).max(100).optional(),
    start: z.string().trim().max(100).optional(),
    end: z.string().trim().max(100).optional(),
  }).transform((value) => {
    const label = value.label || value.start || "Available time";
    return {
      label,
      startIso: validIso(value.start) ?? resolveAppointmentTimeLabel(label),
      endIso: validIso(value.end),
    };
  }),
]);

const resultSchema = z.object({
  available_times: z.array(timeSchema).max(10).default([]),
  estimated_cost: z.union([z.string(), z.number()]).nullable().optional(),
  insurance_response: z.string().trim().max(500).nullable().optional(),
  office_requirements: z.array(z.string().trim().min(1).max(200)).max(8).default([]),
  follow_up_notes: z.string().trim().max(500).nullable().optional(),
  summary: z.string().trim().min(1).max(500),
});

const appointmentResultSchema = z.object({
  "call summary": z.string().trim().min(1).max(2_000),
  appointment_options: z.array(timeSchema).max(10).default([]),
  consultation_fee: z.union([z.string(), z.number()]).nullable().optional(),
  provides_service: z.boolean().optional(),
  accepts_insurance: z.boolean().optional(),
  referral_required: z.boolean().optional(),
  accepting_new_patients: z.boolean().optional(),
  additional_requirements: z.string().trim().max(500).optional(),
  prior_authorization_required: z.boolean().optional(),
});

const appointmentResultEnvelopeSchema = z.object({
  name: z.literal("appointment_result"),
  result: appointmentResultSchema,
});

export type DoctorCallResult = {
  availableTimes: Array<{ label: string; startIso: string | null; endIso: string | null }>;
  estimatedCost: string | null;
  insuranceResponse: string | null;
  officeRequirements: string[];
  followUpNotes: string | null;
  summary: string;
};

function validIso(value: string | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export function resolveAppointmentTimeLabel(label: string, now = new Date()) {
  const match = label.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b.*?\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/i);
  if (!match) return null;
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const targetWeekday = weekdays.findIndex((day) => day.toLowerCase() === match[1].toLowerCase());
  const hour12 = Number(match[2]);
  const minute = Number(match[3] ?? "0");
  if (targetWeekday < 0 || hour12 < 1 || hour12 > 12 || minute > 59) return null;
  const hour = (hour12 % 12) + (match[4].toUpperCase() === "PM" ? 12 : 0);
  const current = chicagoParts(now);
  const currentWeekday = weekdays.indexOf(current.weekday);
  let dayOffset = (targetWeekday - currentWeekday + 7) % 7;
  if (dayOffset === 0 && (hour < current.hour || (hour === current.hour && minute <= current.minute))) {
    dayOffset = 7;
  }
  const localDay = new Date(Date.UTC(current.year, current.month - 1, current.day + dayOffset));
  return chicagoLocalToIso(
    localDay.getUTCFullYear(),
    localDay.getUTCMonth() + 1,
    localDay.getUTCDate(),
    hour,
    minute,
  );
}

function chicagoParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    weekday: "long",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    weekday: value("weekday"),
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    hour: Number(value("hour")),
    minute: Number(value("minute")),
  };
}

function chicagoLocalToIso(year: number, month: number, day: number, hour: number, minute: number) {
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let utc = desired;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const actual = chicagoParts(new Date(utc));
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute);
    utc += desired - represented;
  }
  return new Date(utc).toISOString();
}

export function normalizeDoctorCallResult(value: unknown): DoctorCallResult | null {
  const parsed = resultSchema.safeParse(value);
  if (parsed.success) {
    return {
      availableTimes: parsed.data.available_times,
      estimatedCost: parsed.data.estimated_cost == null ? null : String(parsed.data.estimated_cost),
      insuranceResponse: parsed.data.insurance_response ?? null,
      officeRequirements: parsed.data.office_requirements,
      followUpNotes: parsed.data.follow_up_notes ?? null,
      summary: parsed.data.summary,
    };
  }

  const envelope = appointmentResultEnvelopeSchema.safeParse(value);
  const appointment = envelope.success
    ? { success: true as const, data: envelope.data.result }
    : appointmentResultSchema.safeParse(value);
  if (!appointment.success) return null;
  const data = appointment.data;
  const requirements = [
    data.referral_required ? "Referral required" : null,
    data.prior_authorization_required ? "Prior authorization required" : null,
    data.additional_requirements || null,
  ].filter((item): item is string => Boolean(item));
  const followUp = [
    data.provides_service === false ? "The office does not provide the requested service." : null,
    data.accepting_new_patients === false ? "The office is not accepting new patients." : null,
  ].filter((item): item is string => Boolean(item));
  const fee = data.consultation_fee == null ? null : String(data.consultation_fee);

  return {
    availableTimes: data.appointment_options,
    estimatedCost: fee ? `${fee.startsWith("$") ? fee : `$${fee}`} consultation fee` : null,
    insuranceResponse: data.accepts_insurance === undefined
      ? null
      : data.accepts_insurance
        ? "The office reported accepting the provided insurance; benefits still require verification."
        : "The office reported not accepting the provided insurance.",
    officeRequirements: requirements,
    followUpNotes: followUp.length ? followUp.join(" ") : null,
    summary: data["call summary"].slice(0, 500),
  };
}
