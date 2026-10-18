import { describe, expect, it } from "vitest";

import {
  bookingTurn,
  chatFollowUpError,
  defaultPreferences,
  defaultProfile,
  emptyProfile,
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

  it("reuses the profile ZIP when the visit type changes", () => {
    const turn = bookingTurn(
      "dental",
      "ready",
      { ...defaultPreferences(), visitType: "annual" },
      defaultProfile(),
    );

    expect(turn.step).toBe("time");
    expect(turn.preferences.visitType).toBe("dental");
    expect(turn.reply).toContain("your ZIP code, 60614");
  });

  it("accepts the professional visit labels", () => {
    const turn = bookingTurn("Other visit", "visit", defaultPreferences(), defaultProfile());

    expect(turn.preferences.visitType).toBe("other");
    expect(turn.step).toBe("time");
  });

  it("asks for a ZIP only when the profile does not have one", () => {
    const turn = bookingTurn("Find me a dentist", "idle", defaultPreferences(), emptyProfile());

    expect(turn.step).toBe("location");
    expect(turn.reply).toContain("Which ZIP");
  });

  it("accepts conversational availability such as Monday nights", () => {
    const turn = bookingTurn(
      "monday nights",
      "time",
      { ...defaultPreferences(), preferredTimes: "" },
      defaultProfile(),
    );

    expect(turn.step).toBe("payment");
    expect(turn.preferences.preferredTimes).toBe("Monday nights");
    expect(turn.reply).toContain("Monday nights");
  });

  it("keeps non-booking questions outside the booking workflow", () => {
    const preferences = defaultPreferences();
    const profile = defaultProfile();
    const turn = bookingTurn("How much does this cost?", "idle", preferences, profile);

    expect(turn.step).toBe("idle");
    expect(turn.preferences).toBe(preferences);
    expect(turn.reply).toContain("self-pay ranges");
  });

  it("guides a Spanish booking conversation", () => {
    const profile = { ...emptyProfile(), language: "Spanish" };
    const visit = bookingTurn("Quiero reservar una cita dental", "idle", defaultPreferences(), profile);
    const location = bookingTurn("60614", visit.step, visit.preferences, profile);
    const time = bookingTurn("lunes por la tarde", location.step, location.preferences, { ...profile, zip: location.zip });
    const payment = bookingTurn("Seguro", time.step, time.preferences, { ...profile, zip: time.zip });

    expect(visit.reply).toContain("código postal");
    expect(time.reply).toContain("¿Cómo deseas pagar?");
    expect(payment.step).toBe("ready");
    expect(payment.reply).toContain("Puedo buscar opciones");
  });

  it("guides a Chinese booking conversation", () => {
    const profile = { ...emptyProfile(), language: "Chinese" };
    const visit = bookingTurn("我想预约牙科", "idle", defaultPreferences(), profile);
    const location = bookingTurn("60614", visit.step, visit.preferences, profile);
    const time = bookingTurn("星期一下午", location.step, location.preferences, { ...profile, zip: location.zip });
    const payment = bookingTurn("保险", time.step, time.preferences, { ...profile, zip: time.zip });

    expect(visit.reply).toContain("邮政编码");
    expect(time.reply).toContain("如何付款");
    expect(payment.step).toBe("ready");
    expect(payment.reply).toContain("我可以查找");
  });
});

describe("chatFollowUpError", () => {
  it("keeps a failed model reply visible", () => {
    expect(chatFollowUpError([
      { id: "user", role: "user", text: "What is a copay?", time: "9:00 AM", status: "complete" },
      { id: "assistant", role: "assistant", text: "GPT rejected the request.", time: "9:00 AM", status: "failed", error: "GPT rejected the request." },
    ])).toBe("GPT rejected the request.");
  });

  it("offers a retry when the user message was saved and the reply never arrived", () => {
    expect(chatFollowUpError([
      { id: "user", role: "user", text: "What is a copay?", time: "9:00 AM", status: "complete" },
    ])).toBe("This request did not finish. You can retry it.");
  });
});
