"use server";

import { auth } from "@/auth";
import { digits, parseDob, type Appointment, type CareSaveResult, type Profile, type SavedCareRequest } from "@/lib/careway/model";
import { cancelSavedAppointment, requestSavedAppointment } from "@/server/database/repositories/appointments";
import { syncCareRequest } from "@/server/database/repositories/care-requests";
import { deleteInsurancePolicies, listInsurancePolicies, saveInsurancePolicy } from "@/server/database/repositories/insurance";
import { findPatientProfile, savePatientProfile } from "@/server/database/repositories/profiles";
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

const optionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function requestAppointmentAction(input: {
  optionId: string;
  shareSms: boolean;
}): Promise<CareSaveResult & { appointment: Appointment | null }> {
  try {
    const user = await authenticatedUser();
    if (!optionIdPattern.test(input.optionId)) {
      return { ok: false, persisted: false, appointment: null, message: "Choose a time from the saved shortlist." };
    }
    const [profile, policies] = await Promise.all([
      findPatientProfile(user.userId),
      listInsurancePolicies(user.userId),
    ]);
    if (!profile) {
      return { ok: false, persisted: false, appointment: null, message: "Save your profile before requesting this visit." };
    }
    if (digits(profile.phoneE164).length < 10) {
      return { ok: false, persisted: false, appointment: null, message: "Add a phone number before requesting this visit." };
    }
    if (!profile.fullName.trim()) {
      return { ok: false, persisted: false, appointment: null, message: "Add your name before requesting this visit." };
    }
    if (!/^\d{5}/.test(profile.postalCode)) {
      return { ok: false, persisted: false, appointment: null, message: "Add a ZIP code before requesting this visit." };
    }
    if (profile.paymentPreference === "INSURANCE") {
      const policy = policies.find((item) => item.active) ?? null;
      if (!policy?.payerName.trim() || !policy.memberId.trim() || !policy.planName.trim()) {
        return { ok: false, persisted: false, appointment: null, message: "Enter the insurer, member ID, and plan name before requesting this visit." };
      }
    }
    const appointment = await requestSavedAppointment({
      userId: user.userId,
      optionId: input.optionId,
      shareSms: input.shareSms,
    });
    return {
      ok: true,
      persisted: true,
      appointment,
      message: "Simulated request saved to Oracle. The office was not contacted.",
    };
  } catch (error) {
    console.error("Appointment request failed", error);
    return {
      ok: false,
      persisted: false,
      appointment: null,
      message: error instanceof Error ? error.message : "The appointment request could not be saved.",
    };
  }
}

export async function cancelAppointmentAction(
  appointmentId: string,
): Promise<CareSaveResult & { appointment: Appointment | null }> {
  try {
    const user = await authenticatedUser();
    if (!optionIdPattern.test(appointmentId)) {
      return { ok: false, persisted: false, appointment: null, message: "This appointment could not be cancelled." };
    }
    const appointment = await cancelSavedAppointment(user.userId, appointmentId);
    return {
      ok: true,
      persisted: true,
      appointment,
      message: "Simulated request cancelled in Oracle. The office was not contacted.",
    };
  } catch (error) {
    console.error("Appointment cancellation failed", error);
    return {
      ok: false,
      persisted: false,
      appointment: null,
      message: error instanceof Error ? error.message : "The appointment could not be cancelled.",
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
