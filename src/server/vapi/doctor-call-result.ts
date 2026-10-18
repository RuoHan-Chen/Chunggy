import { z } from "zod";

const timeSchema = z.union([
  z.string().trim().min(1).max(100).transform((label) => ({ label, startIso: null, endIso: null })),
  z.object({
    label: z.string().trim().min(1).max(100).optional(),
    start: z.string().trim().max(100).optional(),
    end: z.string().trim().max(100).optional(),
  }).transform((value) => ({
    label: value.label || value.start || "Available time",
    startIso: validIso(value.start),
    endIso: validIso(value.end),
  })),
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
  appointment_options: z.array(z.string().trim().min(1).max(100)).max(10).default([]),
  consultation_fee: z.union([z.string(), z.number()]).nullable().optional(),
  provides_service: z.boolean().optional(),
  accepts_insurance: z.boolean().optional(),
  referral_required: z.boolean().optional(),
  accepting_new_patients: z.boolean().optional(),
  additional_requirements: z.string().trim().max(500).optional(),
  prior_authorization_required: z.boolean().optional(),
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

  const appointment = appointmentResultSchema.safeParse(value);
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
    availableTimes: data.appointment_options.map((label) => ({ label, startIso: null, endIso: null })),
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
