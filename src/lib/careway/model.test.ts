import { describe, expect, it } from "vitest";

import {
  bookingTurn,
  defaultPreferences,
  defaultProfile,
  type BookingStep,
} from "./model";

describe("bookingTurn", () => {
  it("collects the required booking details in order", () => {
    let step: BookingStep = "idle";
    let preferences = defaultPreferences();
    let profile = defaultProfile();

    for (const message of [
      "Schedule an appointment",
      "eye",
      "60614",
      "Weekday afternoons",
      "Insurance",
    ]) {
      const turn = bookingTurn(message, step, preferences, profile);
      step = turn.step;
      preferences = turn.preferences;
      profile = { ...profile, zip: turn.zip, payment: turn.payment };
    }

    expect(step).toBe("ready");
    expect(preferences).toMatchObject({
      visitType: "eye",
      location: "Near 60614 within 5 miles",
      preferredTimes: "Weekday afternoons",
      paymentLabel: "Insurance",
    });
    expect(profile).toMatchObject({ zip: "60614", payment: "insurance" });
  });

  it("restarts location collection when the visit type changes", () => {
    const turn = bookingTurn(
      "dental",
      "ready",
      { ...defaultPreferences(), visitType: "annual" },
      defaultProfile(),
    );

    expect(turn.step).toBe("location");
    expect(turn.preferences.visitType).toBe("dental");
    expect(turn.reply).toContain("Which ZIP");
  });

  it("keeps non-booking questions outside the booking workflow", () => {
    const preferences = defaultPreferences();
    const profile = defaultProfile();
    const turn = bookingTurn("How much does this cost?", "idle", preferences, profile);

    expect(turn.step).toBe("idle");
    expect(turn.preferences).toBe(preferences);
    expect(turn.reply).toContain("self-pay ranges");
  });
});
