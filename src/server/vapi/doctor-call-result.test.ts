import { describe, expect, it } from "vitest";

import { normalizeDoctorCallResult, resolveAppointmentTimeLabel } from "./doctor-call-result";

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

  it("resolves weekday-only office times into bookable Chicago timestamps", () => {
    const now = new Date("2026-10-18T17:00:00.000Z");
    expect(resolveAppointmentTimeLabel("Tuesday, 3 PM", now)).toBe("2026-10-20T20:00:00.000Z");
    expect(resolveAppointmentTimeLabel("Monday at 8. AM", now)).toBe("2026-10-19T13:00:00.000Z");
    expect(resolveAppointmentTimeLabel("Tuesday at 9, AM", now)).toBe("2026-10-20T14:00:00.000Z");
    expect(resolveAppointmentTimeLabel("No time reported", now)).toBe("2026-10-19T15:00:00.000Z");
  });

  it("normalizes the appointment_result output attached to the Vapi assistant", () => {
    const result = normalizeDoctorCallResult({
      "call summary": "The office offers consultations and has three openings.",
      consultation_fee: 50,
      provides_service: true,
      accepts_insurance: true,
      referral_required: false,
      appointment_options: ["Monday, 3:00 PM", "Wednesday, 2:00 PM", "Friday, 3:00 PM"],
      accepting_new_patients: true,
      additional_requirements: "",
      prior_authorization_required: false,
    });

    expect(result?.availableTimes.map((time) => time.label)).toEqual([
      expect.stringMatching(/^Monday, \w+ \d+, 3:00 PM$/),
      expect.stringMatching(/^Wednesday, \w+ \d+, 2:00 PM$/),
      expect.stringMatching(/^Friday, \w+ \d+, 3:00 PM$/),
    ]);
    expect(result?.estimatedCost).toBe("$50 consultation fee");
    expect(result?.insuranceResponse).toContain("accepting");
    expect(result?.summary).toContain("three openings");
  });
});
