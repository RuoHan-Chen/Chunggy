import { describe, expect, it, vi } from "vitest";

import { summarizeDoctorCallWithAgent } from "./doctor-call-summary";

describe("doctor call summary agent", () => {
  it("turns a call summary into selectable appointment times", async () => {
    const generate = vi.fn().mockResolvedValue({
      text: JSON.stringify({
        name: "appointment_result",
        result: {
          "call summary": "The office has two openings.",
          consultation_fee: 50,
          provides_service: true,
          accepts_insurance: true,
          referral_required: false,
          appointment_options: [
            {
              label: "Monday, 3:00 PM",
              start: "2026-10-19T15:00:00-05:00",
              end: "2026-10-19T16:00:00-05:00",
            },
            {
              label: "Wednesday, 2:00 PM",
              start: "2026-10-21T14:00:00-05:00",
              end: "2026-10-21T15:00:00-05:00",
            },
          ],
          accepting_new_patients: true,
          additional_requirements: "",
          prior_authorization_required: false,
        },
      }),
    });

    const result = await summarizeDoctorCallWithAgent(
      {
        "call summary": "Open Monday at 3 PM and Wednesday at 2 PM.",
        appointment_options: ["Monday, 3:00 PM", "Wednesday, 2:00 PM"],
      },
      null,
      generate,
    );

    expect(generate).toHaveBeenCalledOnce();
    expect(result?.result.availableTimes[0]?.startIso).toBe("2026-10-19T20:00:00.000Z");
    expect(result?.result.availableTimes[1]?.label).toBe("Wednesday, 2:00 PM");
    expect(result?.structuredOutput).toMatchObject({ name: "appointment_result" });
  });

  it("falls back to the structured result when the agent fails", async () => {
    const result = await summarizeDoctorCallWithAgent(
      {
        "call summary": "Open Friday at 3 PM.",
        appointment_options: ["Friday, 3:00 PM"],
      },
      null,
      async () => {
        throw new Error("OCI unavailable");
      },
    );

    expect(result?.result.availableTimes[0]?.label).toBe("Friday, 3:00 PM");
    expect(result?.result.availableTimes[0]?.startIso).toMatch(/T20:00:00\.000Z$/);
  });
});
