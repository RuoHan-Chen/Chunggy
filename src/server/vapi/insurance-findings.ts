import { z } from "zod";

const findingsSchema = z
  .object({
    coverage_status: z.enum(["covered", "not_covered", "unknown"]).default("unknown"),
    coverage_percent: z.number().finite().min(0).max(100).nullable().optional(),
    copay: z.number().finite().min(0).nullable().optional(),
    deductible_remaining: z.number().finite().min(0).nullable().optional(),
    prior_authorization_required: z.boolean().nullable().optional(),
    in_network_required: z.boolean().nullable().optional(),
    unresolved_questions: z.union([z.array(z.string()), z.string()]).optional(),
    call_summary: z.string().trim().min(1),
  })
  .strict();

export type InsuranceFindings = {
  coverage_status: "covered" | "not_covered" | "unknown";
  coverage_percent: number | null;
  copay: number | null;
  deductible_remaining: number | null;
  prior_authorization_required: boolean | null;
  in_network_required: boolean | null;
  unresolved_questions: string[];
  call_summary: string;
};

export type NormalizedFindings = {
  findings: InsuranceFindings | null;
  issues: string[];
};

/** Validates Vapi's untrusted extraction; a missing field stays unknown. */
export function normalizeInsuranceFindings(input: unknown): NormalizedFindings {
  const parsed = findingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      findings: null,
      issues: parsed.error.issues.map((issue) =>
        `${issue.path.join(".") || "result"}: ${issue.message}`,
      ),
    };
  }

  const value = parsed.data;
  const questions = typeof value.unresolved_questions === "string"
    ? value.unresolved_questions.trim() ? [value.unresolved_questions.trim()] : []
    : (value.unresolved_questions ?? []).map((question) => question.trim()).filter(Boolean);

  return {
    findings: {
      coverage_status: value.coverage_status,
      coverage_percent: value.coverage_percent ?? null,
      copay: value.copay ?? null,
      deductible_remaining: value.deductible_remaining ?? null,
      prior_authorization_required: value.prior_authorization_required ?? null,
      in_network_required: value.in_network_required ?? null,
      unresolved_questions: questions,
      call_summary: value.call_summary,
    },
    issues: [],
  };
}
