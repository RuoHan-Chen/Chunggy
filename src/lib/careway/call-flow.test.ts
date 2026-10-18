import { describe, expect, it } from "vitest";

import { defaultPreferences } from "./model";
import { declineResult, emptyCallDraft, formatRetrievedCall, isCallConfirmation, isDeclinedCall, isFakeCallConfirmation, isSideQuestion, resumeAfterSideQuestion } from "./call-flow";

describe("call flow", () => {
  it("treats an informational question as a side question", () => {
    expect(isSideQuestion("What is a deductible?")).toBe(true);
    expect(isSideQuestion("60614")).toBe(false);
    expect(isSideQuestion("Weekday mornings")).toBe(false);
  });

  it("resumes the missing appointment detail after a side question", () => {
    const reply = resumeAfterSideQuestion("location", { ...defaultPreferences(), visitType: "dental" }, emptyCallDraft());

    expect(reply).toBe("To continue finding your dentist, what ZIP should I search near?");
  });

  it("keeps the call brief active when the user asks a question during review", () => {
    const reply = resumeAfterSideQuestion(
      "ready",
      defaultPreferences(),
      { ...emptyCallDraft(), workflow: "review", officeName: "Lakeview Dental" },
    );

    expect(reply).toContain("confirm the call brief");
  });

  it("allows one more call after the first decline", () => {
    expect(isDeclinedCall("ended", "customer-did-not-answer")).toBe(true);
    const first = declineResult(0, "Lakeview Dental");

    expect(first.workflow).toBe("review");
    expect(first.declineCount).toBe(1);
    expect(first.reply).toContain("declined the call");
    expect(first.reply).not.toContain("Call failed");
  });

  it("shows call failed after the second decline", () => {
    const second = declineResult(1, "Lakeview Dental");

    expect(second.workflow).toBe("failed");
    expect(second.declineCount).toBe(2);
    expect(second.reply.startsWith("Call failed.")).toBe(true);
    expect(second.reply).toContain("Try again later.");
  });

  it("distinguishes real and fake call confirmations", () => {
    expect(isCallConfirmation("Real Vapi call")).toBe(true);
    expect(isFakeCallConfirmation("Real Vapi call")).toBe(false);
    expect(isCallConfirmation("Fake demo call")).toBe(true);
    expect(isFakeCallConfirmation("Fake demo call")).toBe(true);
  });

  it("labels fake results without claiming the office was contacted", () => {
    const reply = formatRetrievedCall("Lakeview Dental", ["Available times: Tuesday at 11:00 AM"], true);

    expect(reply).toContain("fake demo call");
    expect(reply).toContain("office was not contacted");
    expect(reply).toContain("simulated demo results");
    expect(reply).not.toContain("live Vapi call");
  });
});
