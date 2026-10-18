import { z } from "zod";

const trimmed = (maximum: number) => z.string().trim().min(1).max(maximum);
const optionalTrimmed = (maximum: number) =>
  z.string().trim().max(maximum).optional().transform((value) => value || undefined);

export const authIdentitySchema = z.object({
  provider: trimmed(30).transform((value) => value.toLowerCase()),
  subject: trimmed(255),
  email: z.email().max(320).transform((value) => value.toLowerCase()),
  displayName: optionalTrimmed(200),
});

export const patientProfileSchema = z.object({
  userId: z.uuid(),
  fullName: trimmed(200),
  phoneE164: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, "Use an E.164 phone number such as +13125550142"),
  dateOfBirth: z.iso.date(),
  postalCode: z.string().trim().regex(/^\d{5}(?:-\d{4})?$/),
  addressLine1: optionalTrimmed(200),
  addressLine2: optionalTrimmed(200),
  city: optionalTrimmed(100),
  region: optionalTrimmed(100),
  countryCode: z.string().trim().length(2).default("US").transform((value) => value.toUpperCase()),
  preferredLanguage: trimmed(35).default("English"),
  paymentPreference: z.enum(["INSURANCE", "SELF", "LATER"]),
  onboardingStatus: z.enum(["NOT_STARTED", "DEFERRED", "COMPLETE"]),
});

export const insurancePolicySchema = z.object({
  policyId: z.uuid(),
  userId: z.uuid(),
  payerName: trimmed(200),
  planName: trimmed(200),
  memberId: trimmed(120),
  groupId: optionalTrimmed(120),
  active: z.boolean().default(true),
});

export const providerSearchSchema = z.object({
  appointmentType: z.enum(["dental", "eye", "annual", "other"]),
  minimumRating: z.number().min(0).max(5).default(0),
  limit: z.number().int().min(1).max(50).default(20),
});

export type AuthIdentityInput = z.infer<typeof authIdentitySchema>;
export type PatientProfileInput = z.infer<typeof patientProfileSchema>;
export type InsurancePolicyInput = z.infer<typeof insurancePolicySchema>;
export type ProviderSearchInput = z.infer<typeof providerSearchSchema>;
