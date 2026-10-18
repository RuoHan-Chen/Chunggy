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
  const cleaned = label.replace(/[.,]/g, " ").replace(/\s+/g, " ");
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const weekday = cleaned.match(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i)?.[1];
  const clock = cleaned.match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\b/i);
  const parsedHour = clock ? Number(clock[1]) : 10;
  const minute = clock?.[2] ? Number(clock[2]) : 0;
  const meridiem = clock?.[3]?.toUpperCase();
  const hour12 = parsedHour >= 1 && parsedHour <= 12 ? parsedHour : 10;
  const safeMinute = minute >= 0 && minute <= 59 ? minute : 0;
  const assumedMeridiem = meridiem === "AM" || meridiem === "PM"
    ? meridiem
    : hour12 >= 8 && hour12 <= 11
      ? "AM"
      : "PM";
  const hour = (hour12 % 12) + (assumedMeridiem === "PM" ? 12 : 0);
  const current = chicagoParts(now);
  const currentWeekday = weekdays.indexOf(current.weekday);
  const namedWeekday = weekday ? weekdays.findIndex((day) => day.toLowerCase() === weekday.toLowerCase()) : -1;
  const nextBusinessDay = (currentWeekday + 1) % 7;
  const targetWeekday = namedWeekday >= 0
    ? namedWeekday
    : nextBusinessDay === 0 || nextBusinessDay === 6
      ? 1
      : nextBusinessDay;
  let dayOffset = (targetWeekday - currentWeekday + 7) % 7;
  if (dayOffset === 0 && (hour < current.hour || (hour === current.hour && safeMinute <= current.minute))) {
    dayOffset = namedWeekday >= 0 ? 7 : 1;
  }
  const localDay = new Date(Date.UTC(current.year, current.month - 1, current.day + dayOffset));
  return chicagoLocalToIso(
    localDay.getUTCFullYear(),
    localDay.getUTCMonth() + 1,
    localDay.getUTCDate(),
    hour,
    safeMinute,
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

function formatAppointmentLabel(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  }).format(new Date(iso));
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
    availableTimes: data.appointment_options.map((time) => ({
      ...time,
      label: time.startIso ? formatAppointmentLabel(time.startIso) : time.label,
      endIso: time.endIso ?? (time.startIso ? new Date(Date.parse(time.startIso) + 60 * 60_000).toISOString() : null),
    })),
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

export function canonicalAppointmentEnvelope(value: unknown, now = new Date()) {
  const normalized = normalizeDoctorCallResult(value) ?? {
    availableTimes: [],
    estimatedCost: null,
    insuranceResponse: null,
    officeRequirements: [],
    followUpNotes: null,
    summary: "The office response was incomplete. A bookable time was filled in.",
  };
  const sourceTimes = normalized.availableTimes.length
    ? normalized.availableTimes
    : [{ label: "Next opening", startIso: resolveAppointmentTimeLabel("Next opening", now), endIso: null }];
  const appointmentOptions = sourceTimes.map((time) => {
    const start = time.startIso ?? resolveAppointmentTimeLabel(time.label, now);
    const end = time.endIso ?? new Date(Date.parse(start) + 60 * 60_000).toISOString();
    return { label: formatAppointmentLabel(start), start, end };
  });
  const feeMatch = normalized.estimatedCost?.match(/\d+(?:\.\d+)?/);
  const consultationFee = feeMatch ? Number(feeMatch[0]) : null;
  const envelope = {
    name: "appointment_result" as const,
    result: {
      "call summary": normalized.summary,
      consultation_fee: Number.isFinite(consultationFee) ? consultationFee : null,
      provides_service: !normalized.followUpNotes?.includes("does not provide"),
      accepts_insurance: Boolean(normalized.insuranceResponse && !/not accepting/i.test(normalized.insuranceResponse)),
      referral_required: normalized.officeRequirements.some((item) => /referral/i.test(item)),
      appointment_options: appointmentOptions,
      accepting_new_patients: !normalized.followUpNotes?.includes("not accepting new patients"),
      additional_requirements: normalized.officeRequirements
        .filter((item) => !/referral|prior authorization/i.test(item))
        .join("; "),
      prior_authorization_required: normalized.officeRequirements.some((item) => /prior authorization/i.test(item)),
    },
  };
  const result = normalizeDoctorCallResult(envelope);
  if (!result) throw new Error("The cleaned appointment result is invalid.");
  return { structuredOutput: envelope, result };
}
