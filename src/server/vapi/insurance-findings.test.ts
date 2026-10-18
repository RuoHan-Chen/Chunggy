import { describe, expect, it } from "vitest";

import { normalizeInsuranceFindings } from "./insurance-findings";

describe("normalizeInsuranceFindings", () => {
  it("preserves zero and normalizes an empty question string", () => {
    const result = normalizeInsuranceFindings({
      coverage_status: "covered",
      copay: 0,
      unresolved_questions: "",
      call_summary: "Representative reported the service is covered.",
    });
    expect(result.findings?.copay).toBe(0);
    expect(result.findings?.deductible_remaining).toBeNull();
    expect(result.findings?.unresolved_questions).toEqual([]);
  });

  it("keeps unknown benefit details null and preserves questions", () => {
    const result = normalizeInsuranceFindings({
      coverage_status: "unknown",
      unresolved_questions: ["Is prior authorization needed?"],
      call_summary: "The representative could not confirm coverage.",
    });
    expect(result.findings?.coverage_percent).toBeNull();
    expect(result.findings?.prior_authorization_required).toBeNull();
    expect(result.findings?.unresolved_questions).toEqual(["Is prior authorization needed?"]);
  });

  it("rejects unexpected types and out-of-range percentages", () => {
    expect(normalizeInsuranceFindings({
      coverage_status: "covered",
      coverage_percent: 130,
      copay: "0",
      call_summary: "Summary",
    }).findings).toBeNull();
  });
});
