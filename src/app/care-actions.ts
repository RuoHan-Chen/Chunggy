"use server";

import { auth } from "@/auth";
import { digits, parseDob, type CareSaveResult, type Profile, type SavedCareRequest } from "@/lib/careway/model";
import { syncCareRequest } from "@/server/database/repositories/care-requests";
import { deleteInsurancePolicies, saveInsurancePolicy } from "@/server/database/repositories/insurance";
import { savePatientProfile } from "@/server/database/repositories/profiles";
import { resolveDatabaseUser } from "@/server/care-data";

async function authenticatedUser() {
  const session = await auth();
  if (!session?.user) throw new Error("You must sign in again");
  return resolveDatabaseUser(session);
}

export async function saveProfileAction(
  profile: Profile,
  onboardingStatus: "NOT_STARTED" | "DEFERRED" | "COMPLETE",
): Promise<CareSaveResult> {
  try {
    const user = await authenticatedUser();
    const dob = parseDob(profile.dateOfBirth);
    if (!dob) throw new Error("Enter a valid date of birth");
    const phone = digits(profile.phone);
    await savePatientProfile({
      userId: user.userId,
      fullName: profile.fullName,
      phoneE164: `+1${phone}`,
      dateOfBirth: `${dob.year}-${String(dob.month).padStart(2, "0")}-${String(dob.day).padStart(2, "0")}`,
      addressLine1: profile.addressLine1 || undefined,
      city: profile.city || undefined,
      region: profile.region || undefined,
      postalCode: profile.zip,
      countryCode: "US",
      preferredLanguage: profile.language,
      paymentPreference: profile.payment.toUpperCase(),
      onboardingStatus,
    });
    return { ok: true, persisted: true, message: "Profile saved to Oracle." };
  } catch (error) {
    console.error("Profile save failed", error);
    return { ok: false, persisted: false, message: error instanceof Error ? error.message : "Profile could not be saved." };
  }
}

export async function saveInsuranceAction(
  profile: Profile,
  existingPolicyId: string | null,
): Promise<CareSaveResult> {
  try {
    const user = await authenticatedUser();
    const policyId = existingPolicyId ?? crypto.randomUUID();
    await saveInsurancePolicy({
      policyId,
      userId: user.userId,
      payerName: profile.insuranceCompany,
      planName: profile.planName,
      memberId: profile.memberId,
      active: true,
    });
    return { ok: true, persisted: true, message: "Insurance saved to Oracle.", insurancePolicyId: policyId };
  } catch (error) {
    console.error("Insurance save failed", error);
    return { ok: false, persisted: false, message: error instanceof Error ? error.message : "Insurance could not be saved." };
  }
}

export async function syncCareRequestAction(input: {
  requestId?: string;
  visitType: string;
  postalCode: string;
  timePreference: string;
  paymentPreference: Profile["payment"];
  radiusMiles?: number;
}): Promise<CareSaveResult & { saved: SavedCareRequest | null }> {
  try {
    const user = await authenticatedUser();
    if (!/^\d{5}$/.test(input.postalCode)) {
      return { ok: false, persisted: false, saved: null, message: "Enter a 5-digit ZIP before searching." };
    }
    const saved = await syncCareRequest({
      userId: user.userId,
      requestId: input.requestId,
      visitType: input.visitType,
      postalCode: input.postalCode,
      radiusMiles: input.radiusMiles ?? 5,
      timePreference: input.timePreference,
      paymentPreference: input.paymentPreference.toUpperCase() as "INSURANCE" | "SELF" | "LATER",
    });
    return {
      ok: true,
      persisted: true,
      saved,
      message: saved.options.length > 0
        ? `Saved ${saved.options.length} options to Oracle.`
        : "Saved the request. No providers matched these filters.",
    };
  } catch (error) {
    console.error("Care request save failed", error);
    return {
      ok: false,
      persisted: false,
      saved: null,
      message: error instanceof Error ? error.message : "The care request could not be saved.",
    };
  }
}

export async function removeInsuranceAction(): Promise<CareSaveResult> {
  try {
    const user = await authenticatedUser();
    await deleteInsurancePolicies(user.userId);
    return { ok: true, persisted: true, message: "Insurance removed from Oracle.", insurancePolicyId: null };
  } catch (error) {
    console.error("Insurance removal failed", error);
    return { ok: false, persisted: false, message: error instanceof Error ? error.message : "Insurance could not be removed." };
  }
}
