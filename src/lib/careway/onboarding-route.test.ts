import { describe, expect, it } from "vitest";

import { onboardingRedirect } from "./onboarding-route";

describe("onboarding route guard", () => {
  it("sends an unfinished profile from care pages to onboarding", () => {
    expect(onboardingRedirect("care", { onboardingComplete: false, deferred: false })).toBe("/onboarding");
  });

  it("allows completed and deferred profiles to open care pages", () => {
    expect(onboardingRedirect("care", { onboardingComplete: true, deferred: false })).toBeNull();
    expect(onboardingRedirect("care", { onboardingComplete: false, deferred: true })).toBeNull();
  });

  it("sends a completed profile away from onboarding", () => {
    expect(onboardingRedirect("onboarding", { onboardingComplete: true, deferred: false })).toBe("/home");
    expect(onboardingRedirect("onboarding", { onboardingComplete: false, deferred: false })).toBeNull();
  });
});
