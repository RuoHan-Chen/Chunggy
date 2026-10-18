import "server-only";

import type { Session } from "next-auth";

import {
  databaseSnapshot,
  defaultSnapshot,
  formatPhone,
  locationLabel,
  isOpenAppointment,
  paymentLabel,
  slotsFor,
  type CareBootstrap,
  type PaymentChoice,
  type Profile,
  type Slot,
} from "@/lib/careway/model";
import { listAppointments } from "@/server/database/repositories/appointments";
import { listInsurancePolicies } from "@/server/database/repositories/insurance";
import { findPatientProfile } from "@/server/database/repositories/profiles";
import { findOpenCareRequest } from "@/server/database/repositories/care-requests";
import { listProviderServices } from "@/server/database/repositories/providers";
import { upsertAuthenticatedUser } from "@/server/database/repositories/users";

export function identityFromSession(session: Session) {
  const email = session.user?.email;
  if (!email) throw new Error("Google did not provide an email address");
  return {
    provider: "google",
    subject: email.toLowerCase(),
    email,
    displayName: session.user?.name ?? undefined,
  };
}

export async function resolveDatabaseUser(session: Session) {
  return upsertAuthenticatedUser(identityFromSession(session));
}

function displayDob(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${month} / ${day} / ${year}` : "";
}

function payment(value: "INSURANCE" | "SELF" | "LATER"): PaymentChoice {
  return value.toLowerCase() as PaymentChoice;
}

function slotsFromProviders(rows: Awaited<ReturnType<typeof listProviderServices>>): Slot[] {
  const templates = slotsFor("dental", "Flexible");
  return rows.map((row, index) => {
    const template = templates[index % templates.length];
    const estimate = row.selfPayMin == null
      ? "price unavailable"
      : row.selfPayMax == null || row.selfPayMax === row.selfPayMin
        ? `$${row.selfPayMin}`
        : `$${row.selfPayMin}–$${row.selfPayMax}`;
    return {
      ...template,
      id: `${row.locationId}-${row.appointmentType}`,
      visitType: row.appointmentType,
      provider: row.providerName,
      duration: `${row.durationMinutes} min`,
      address: row.addressLine1,
      cityLine: `${row.city}, ${row.region} ${row.postalCode}`,
      reference: `CW-${row.locationId.slice(0, 6).toUpperCase()}`,
      estimate,
      rating: row.rating?.toFixed(1) ?? "New",
    };
  });
}

export async function loadCareBootstrap(session: Session): Promise<CareBootstrap> {
  const name = session.user?.name || "Assurance member";
  try {
    const user = await resolveDatabaseUser(session);
    const [record, policies, providerGroups, savedCareRequest, appointments] = await Promise.all([
      findPatientProfile(user.userId),
      listInsurancePolicies(user.userId),
      Promise.all(
        (["dental", "eye", "annual", "other"] as const).map((appointmentType) =>
          listProviderServices({ appointmentType, minimumRating: 0, limit: 20 }),
        ),
      ),
      findOpenCareRequest(user.userId).catch((error: { errorNum?: number }) => {
        if (error?.errorNum === 942) return null;
        throw error;
      }),
      listAppointments(user.userId).catch((error: { errorNum?: number }) => {
        if (error?.errorNum === 942) return [];
        throw error;
      }),
    ]);
    const policy = policies.find((candidate) => candidate.active) ?? policies[0] ?? null;
    const snapshot = databaseSnapshot(name);
    if (record) {
      const profile: Profile = {
        ...snapshot.profile,
        fullName: record.fullName,
        phone: formatPhone(record.phoneE164.replace(/^\+1/, "")),
        dateOfBirth: displayDob(record.dateOfBirth),
        addressLine1: record.addressLine1 ?? "",
        city: record.city ?? "",
        region: record.region ?? "",
        zip: record.postalCode.slice(0, 5),
        language: record.preferredLanguage,
        payment: payment(record.paymentPreference),
        onboardingComplete: record.onboardingStatus === "COMPLETE",
        deferred: record.onboardingStatus === "DEFERRED",
        insuranceCompany: policy?.payerName ?? "",
        memberId: policy?.memberId ?? "",
        planName: policy?.planName ?? "",
        coverageStatus: policy?.verificationStatus === "REQUESTED" ? "requested" : "not_verified",
      };
      snapshot.profile = profile;
      snapshot.preferences = {
        ...snapshot.preferences,
        location: locationLabel(profile.zip),
        paymentLabel: paymentLabel(profile.payment),
      };
    }
    snapshot.appointment = appointments.find((item) => isOpenAppointment(item.status)) ?? appointments[0] ?? null;
    return {
      mode: "database",
      snapshot,
      insurancePolicyId: policy?.policyId ?? null,
      providerSlots: slotsFromProviders(providerGroups.flat()),
      savedCareRequest,
      appointments,
      message: null,
    };
  } catch (error) {
    console.error("Oracle care bootstrap failed", error);
    return {
      mode: "fallback",
      snapshot: defaultSnapshot(name),
      insurancePolicyId: null,
      providerSlots: slotsFor("dental", "Flexible"),
      savedCareRequest: null,
      appointments: [],
      message: "Development data — database disconnected. Changes last only for this browser session.",
    };
  }
}
