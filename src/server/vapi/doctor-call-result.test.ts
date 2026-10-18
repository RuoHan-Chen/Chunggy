import { describe, expect, it } from "vitest";

import { normalizeDoctorCallResult } from "./doctor-call-result";

describe("doctor call result", () => {
  it("normalizes appointment details returned by Vapi", () => {
    const result = normalizeDoctorCallResult({
      available_times: [
        {
          label: "Tuesday at 10:30 AM",
          start: "2026-10-20T15:30:00.000Z",
          end: "2026-10-20T16:15:00.000Z",
        },
      ],
      estimated_cost: "$120–$180",
      insurance_response: "The office will verify benefits before the visit.",
      office_requirements: ["Bring a photo ID", "Arrive 15 minutes early"],
      follow_up_notes: "Call back if the patient wants a later time.",
      summary: "The office has one matching opening.",
    });

    expect(result?.availableTimes[0]).toEqual({
      label: "Tuesday at 10:30 AM",
      startIso: "2026-10-20T15:30:00.000Z",
      endIso: "2026-10-20T16:15:00.000Z",
    });
    expect(result?.estimatedCost).toBe("$120–$180");
    expect(result?.officeRequirements).toHaveLength(2);
  });

  it("rejects malformed results instead of inventing availability", () => {
    expect(normalizeDoctorCallResult({ available_times: ["Tomorrow"] })).toBeNull();
    expect(normalizeDoctorCallResult(null)).toBeNull();
  });
});
