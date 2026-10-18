import { describe, expect, it } from "vitest";

import {
  authIdentitySchema,
  insurancePolicySchema,
  patientProfileSchema,
  providerSearchSchema,
} from "./validation";

const userId = "6d231fc0-b464-4c48-9cc9-d466a5ec3ceb";

describe("database input validation", () => {
  it("normalizes an authenticated identity", () => {
    expect(
      authIdentitySchema.parse({
        provider: " Google ",
        subject: "google-subject",
        email: "USER@EXAMPLE.COM",
        displayName: " Maya Chen ",
      }),
    ).toEqual({
      provider: "google",
      subject: "google-subject",
      email: "user@example.com",
      displayName: "Maya Chen",
    });
  });

  it("rejects an invalid profile before it reaches Oracle", () => {
    expect(() =>
      patientProfileSchema.parse({
        userId,
        fullName: "Maya Chen",
        phoneE164: "312-555-0142",
        dateOfBirth: "1990-01-01",
        postalCode: "60614",
        preferredLanguage: "English",
        paymentPreference: "SELF",
        onboardingStatus: "COMPLETE",
      }),
    ).toThrow(/E\.164/);
  });

  it("accepts manually entered insurance fields without document metadata", () => {
    const policy = insurancePolicySchema.parse({
      policyId: "eb79a625-7554-4afd-925c-ecc86c13087f",
      userId,
      payerName: "Example Health",
      planName: "Example PPO",
      memberId: "ABC123",
    });

    expect(policy).toMatchObject({
      payerName: "Example Health",
      memberId: "ABC123",
      active: true,
    });
    expect(policy).not.toHaveProperty("document");
  });

  it("limits provider searches to known appointment types and bounded results", () => {
    expect(providerSearchSchema.parse({ appointmentType: "dental" })).toEqual({
      appointmentType: "dental",
      minimumRating: 0,
      limit: 20,
    });
    expect(() =>
      providerSearchSchema.parse({ appointmentType: "dental", limit: 1000 }),
    ).toThrow();
  });
});
