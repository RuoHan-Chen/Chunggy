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
  if (!parsed.success) return null;
  return {
    availableTimes: parsed.data.available_times,
    estimatedCost: parsed.data.estimated_cost == null ? null : String(parsed.data.estimated_cost),
    insuranceResponse: parsed.data.insurance_response ?? null,
    officeRequirements: parsed.data.office_requirements,
    followUpNotes: parsed.data.follow_up_notes ?? null,
    summary: parsed.data.summary,
  };
}
