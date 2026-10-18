"use server";

import { auth } from "@/auth";
import { declineResult, formatRetrievedCall, isDeclinedCall } from "@/lib/careway/call-flow";
import { ConfigurationError } from "@/lib/env";
import { digits, parseDob, type Appointment, type BookingStep, type CallDraft, type CareSaveResult, type ChatContextItem, type ChatProvider, type ChatSession, type Preferences, type Profile, type SavedCareRequest } from "@/lib/careway/model";
import { cancelSavedAppointment, findBookingCallTarget, findShownAppointmentOption, requestSavedAppointment } from "@/server/database/repositories/appointments";
import { findCareRequest, saveOfficeOutreach, saveVapiAppointmentOptions, syncCareRequest, updateOfficeOutreach } from "@/server/database/repositories/care-requests";
import { createVapiDoctorCall, getVapiCall, VapiApiError } from "@/server/vapi/client";
import { canonicalAppointmentEnvelope, resolveAppointmentTimeLabel } from "@/server/vapi/doctor-call-result";
import { summarizeDoctorCallWithAgent } from "@/server/vapi/doctor-call-summary";
import {
  addConversationContext,
  completeAssistantMessage,
  ConversationAccessError,
  deleteConversation,
  openConversation,
  recordConversationTurn,
  type StoredMessageInput,
} from "@/server/database/repositories/conversations";
import { deleteInsurancePolicies, listInsurancePolicies, saveInsurancePolicy } from "@/server/database/repositories/insurance";
import { findPatientProfile, savePatientProfile } from "@/server/database/repositories/profiles";
import { findProviderService } from "@/server/database/repositories/providers";
import { resolveDatabaseUser } from "@/server/care-data";
import { DEMO_CALL_DESTINATION } from "@/server/vapi/demo-offices";

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
  requestId?: string;
  locationId?: string;
  startIso?: string;
  shareSms: boolean;
  callMode: "real" | "fake";
}): Promise<CareSaveResult & { appointment: Appointment | null }> {
  try {
    const user = await authenticatedUser();
    const currentOption = input.requestId && input.locationId && input.startIso
      ? await findShownAppointmentOption({
          userId: user.userId,
          requestId: input.requestId,
          locationId: input.locationId,
          startIso: input.startIso,
        })
      : null;
    const optionId = currentOption?.optionId ?? input.optionId;
    if (!optionIdPattern.test(optionId)) {
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
    const target = await findBookingCallTarget(user.userId, optionId);
    if (!target) {
      return { ok: false, persisted: false, appointment: null, message: "That appointment time is no longer available. Choose another time." };
    }
    if (input.callMode === "real") {
      if (target.failedBookingCalls >= 2) {
        return {
          ok: false,
          persisted: false,
          appointment: null,
          message: `The booking call to ${target.providerName} has failed twice. No further call will be placed right now. Try again later.`,
        };
      }
      const attemptId = await saveOfficeOutreach({
        userId: user.userId,
        requestId: target.requestId,
        destination: DEMO_CALL_DESTINATION,
        status: "CALLING",
        summary: `Calling ${target.providerName} to request the selected appointment.`,
      });
      try {
        const policy = policies.find((item) => item.active) ?? policies[0];
        const preferredTime = new Intl.DateTimeFormat("en-US", {
          dateStyle: "full",
          timeStyle: "short",
          timeZone: "America/Chicago",
        }).format(new Date(target.offeredStart));
        const created = await createVapiDoctorCall({
          officeName: target.providerName,
          officePhone: DEMO_CALL_DESTINATION,
          patientName: profile.fullName,
          patientPhone: profile.phoneE164,
          patientDateOfBirth: profile.dateOfBirth,
          patientAddress: [profile.addressLine1, profile.city, profile.region, profile.postalCode].filter(Boolean).join(", "),
          patientLanguage: profile.preferredLanguage,
          visitType: target.visitType,
          reason: `Request the selected ${target.visitType} appointment and confirm whether the office can book it.`,
          preferredTimes: `Selected appointment: ${preferredTime}`,
          payment: profile.paymentPreference.toLowerCase(),
          insurance: policy ? `${policy.payerName}; ${policy.planName}; member ${policy.memberId}` : "",
        });
        await updateOfficeOutreach({
          userId: user.userId,
          attemptId,
          status: "CALLING",
          externalReference: created.callId,
          summary: `Vapi is asking ${target.providerName} to book the selected time.`,
        });
        const call = await waitForDoctorCall(created.callId, created.assistantId);
        if (isDeclinedCall(call.status, call.endedReason) || call.status.toLowerCase() === "failed") {
          const failedTwice = target.failedBookingCalls >= 1;
          const detail = failedTwice
            ? `The booking call to ${target.providerName} failed twice. No further call will be placed right now. Try again later.`
            : `The booking call to ${target.providerName} did not complete${call.endedReason ? `: ${call.endedReason.replaceAll("-", " ")}` : "."} You can try one more time.`;
          await updateOfficeOutreach({
            userId: user.userId,
            attemptId,
            status: "FAILED",
            externalReference: call.callId,
            summary: `BOOKING_CALL_FAILED: ${detail}`.slice(0, 500),
          });
          return { ok: false, persisted: false, appointment: null, message: detail };
        }
        await updateOfficeOutreach({
          userId: user.userId,
          attemptId,
          status: "COMPLETED",
          externalReference: call.callId,
          summary: (call.transcript?.trim() || "The real Vapi booking call completed. Waiting for office confirmation.").slice(0, 500),
        });
      } catch (error) {
        const detail = error instanceof ConfigurationError
          ? "Real booking calls are not configured. Add the Vapi private key, doctor assistant ID, and outbound phone number ID."
          : error instanceof Error ? error.message : "The real booking call could not be completed.";
        await updateOfficeOutreach({
          userId: user.userId,
          attemptId,
          status: "FAILED",
          summary: detail.slice(0, 500),
        }).catch(() => undefined);
        return { ok: false, persisted: false, appointment: null, message: detail };
      }
    }
    const appointment = await requestSavedAppointment({
      userId: user.userId,
      optionId,
      shareSms: input.shareSms,
      callMode: input.callMode,
    });
    return {
      ok: true,
      persisted: true,
      appointment,
      message: input.callMode === "real"
        ? "The real Vapi booking call completed and the appointment request was saved."
        : "The fake booking call completed. The office was not contacted.",
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

export type ConversationActionResult = {
  ok: boolean;
  message: string;
  session: ChatSession | null;
};

function conversationFailure(error: unknown, fallback: string): ConversationActionResult {
  if (error instanceof ConversationAccessError) {
    return { ok: false, message: error.message, session: null };
  }
  console.error(fallback, error);
  return {
    ok: false,
    message: error instanceof Error ? error.message : fallback,
    session: null,
  };
}

export async function openConversationAction(conversationId: string): Promise<ConversationActionResult> {
  try {
    const user = await authenticatedUser();
    const session = await openConversation(user.userId, conversationId);
    if (!session) return { ok: false, message: "Conversation not found", session: null };
    return { ok: true, message: "Conversation loaded.", session };
  } catch (error) {
    return conversationFailure(error, "Conversation could not be loaded.");
  }
}

export async function recordConversationAction(input: {
  conversationId: string | null;
  title: string;
  provider: ChatProvider;
  bookingStep: BookingStep;
  preferences: Preferences;
  messages: StoredMessageInput[];
  context: ChatContextItem[];
  draftJson?: string | null;
}): Promise<ConversationActionResult> {
  try {
    const user = await authenticatedUser();
    const session = await recordConversationTurn({ ...input, userId: user.userId });
    return { ok: true, message: "Conversation saved.", session };
  } catch (error) {
    return conversationFailure(error, "Conversation could not be saved.");
  }
}

export async function completeAssistantAction(input: {
  conversationId: string;
  replaceMessageId: string | null;
  message: StoredMessageInput;
}): Promise<ConversationActionResult> {
  try {
    const user = await authenticatedUser();
    const session = await completeAssistantMessage({ ...input, userId: user.userId });
    return { ok: true, message: "Assistant reply saved.", session };
  } catch (error) {
    return conversationFailure(error, "Assistant reply could not be saved.");
  }
}

export async function addConversationContextAction(
  conversationId: string,
  item: ChatContextItem,
): Promise<ConversationActionResult> {
  try {
    const user = await authenticatedUser();
    const session = await addConversationContext({ userId: user.userId, conversationId, item });
    if (!session) return { ok: false, message: "Conversation not found", session: null };
    return { ok: true, message: "Context saved.", session };
  } catch (error) {
    return conversationFailure(error, "Context could not be saved.");
  }
}

export async function deleteConversationAction(conversationId: string): Promise<ConversationActionResult> {
  try {
    const user = await authenticatedUser();
    const deleted = await deleteConversation(user.userId, conversationId);
    if (!deleted) return { ok: false, message: "Conversation not found", session: null };
    return { ok: true, message: "Conversation removed.", session: null };
  } catch (error) {
    return conversationFailure(error, "Conversation could not be removed.");
  }
}

const conversationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const terminalVapiStatuses = new Set(["ended", "completed", "failed"]);

function fakeDoctorCallStructuredOutput() {
  const nextWeekday = (weekday: number, hour: number) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 1);
    date.setUTCHours(hour, 0, 0, 0);
    while (date.getUTCDay() !== weekday) date.setUTCDate(date.getUTCDate() + 1);
    return date;
  };
  const first = nextWeekday(2, 16);
  const second = nextWeekday(4, 20);
  const label = (date: Date) => new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  }).format(date);
  return {
    name: "appointment_result",
    result: {
      "call summary": "Demo availability was generated without contacting the office.",
      consultation_fee: "$120–$180",
      provides_service: true,
      accepts_insurance: true,
      referral_required: false,
      appointment_options: [
        { label: label(first), start: first.toISOString(), end: new Date(first.getTime() + 60 * 60_000).toISOString() },
        { label: label(second), start: second.toISOString(), end: new Date(second.getTime() + 60 * 60_000).toISOString() },
      ],
      accepting_new_patients: true,
      additional_requirements: "Bring a photo ID and insurance card if using insurance. Arrive 15 minutes early.",
      prior_authorization_required: false,
    },
  };
}

async function waitForDoctorCall(callId: string, assistantId: string) {
  const deadline = Date.now() + 4 * 60_000;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const call = await getVapiCall(callId, {
        assistantId,
        outputId: process.env.VAPI_DOCTOR_OUTPUT_ID?.trim(),
      });
      if (terminalVapiStatuses.has(call.status.toLowerCase())) return call;
      lastError = null;
    } catch (error) {
      lastError = error;
      if (error instanceof VapiApiError && error.statusCode && error.statusCode < 500) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }
  if (lastError instanceof Error) throw lastError;
  throw new VapiApiError("The doctor-office call is still in progress. Check Vapi for the final result.", 202);
}

export async function prepareReturnedTimeAction(input: {
  conversationId: string;
  requestId: string;
  locationId: string;
  label: string;
}) {
  const user = await authenticatedUser();
  const conversation = await openConversation(user.userId, input.conversationId);
  if (conversation?.callDraft.locationId !== input.locationId) {
    return { ok: false as const, message: "That office is no longer selected." };
  }
  const returnedTime = conversation?.callDraft.result?.availableTimes.find(
    (time) => time.label === input.label,
  );
  if (!returnedTime) return { ok: false as const, message: "That returned time is no longer available." };
  const startIso = returnedTime.startIso ?? resolveAppointmentTimeLabel(returnedTime.label);
  const existing = await findShownAppointmentOption({
    userId: user.userId,
    requestId: input.requestId,
    locationId: input.locationId,
    startIso,
  });
  if (existing) {
    return {
      ok: true as const,
      option: { ...existing, label: returnedTime.label },
    };
  }
  const saved = await saveVapiAppointmentOptions({
    userId: user.userId,
    requestId: input.requestId,
    locationId: input.locationId,
    times: [{ label: returnedTime.label, startIso, endIso: returnedTime.endIso }],
    replaceExisting: false,
  });
  const option = saved[0];
  if (!option) return { ok: false as const, message: "That returned time could not be saved." };
  return { ok: true as const, option };
}

export async function placeOfficeCallAction(input: {
  conversationId: string | null;
  visitType: string;
  postalCode: string;
  timePreference: string;
  paymentPreference: Profile["payment"];
  locationId: string;
  reason: string;
  declineCount: number;
  simulate?: boolean;
}): Promise<{ ok: boolean; message: string; reply: string; callDraft: CallDraft; saved?: SavedCareRequest }> {
  const failed = (message: string, draft: CallDraft) => ({ ok: false, message, reply: message, callDraft: draft });
  let baseDraft: CallDraft = {
    workflow: "review",
    reason: input.reason,
    officeName: "",
    officePhone: "",
    locationId: input.locationId,
    resultText: "",
    declineCount: input.declineCount,
    result: null,
  };
  try {
    const user = await authenticatedUser();
    const office = await findProviderService(input.locationId, input.visitType);
    if (!office) return failed("That office is no longer available. Choose another office.", baseDraft);
    baseDraft = {
      ...baseDraft,
      officeName: office.providerName,
      officePhone: DEMO_CALL_DESTINATION,
      locationId: office.locationId,
    };
    const declined = (kind: "declined" | "unreachable" = "declined") => {
      const outcome = declineResult(input.declineCount, office.providerName, kind);
      const draft: CallDraft = { ...baseDraft, workflow: outcome.workflow, declineCount: outcome.declineCount, resultText: outcome.reply };
      return { ok: true, message: outcome.reply, reply: outcome.reply, callDraft: draft };
    };
    const profile = await findPatientProfile(user.userId);
    if (!profile?.fullName.trim() || digits(profile.phoneE164).length < 10 || !profile.dateOfBirth || !/^\d{5}/.test(profile.postalCode)) {
      return failed("Add your name, phone, date of birth, and ZIP before calling an office.", baseDraft);
    }
    if (!/^\d{5}$/.test(input.postalCode)) return failed("Enter a 5-digit ZIP before calling an office.", baseDraft);

    const saved = await syncCareRequest({
      userId: user.userId,
      visitType: input.visitType,
      postalCode: input.postalCode,
      radiusMiles: 5,
      timePreference: input.timePreference,
      paymentPreference: input.paymentPreference.toUpperCase() as "INSURANCE" | "SELF" | "LATER",
      conversationId: input.conversationId && conversationIdPattern.test(input.conversationId) ? input.conversationId : null,
    });
    const attemptId = await saveOfficeOutreach({
      userId: user.userId,
      requestId: saved.requestId,
      destination: DEMO_CALL_DESTINATION,
      status: input.simulate ? "COMPLETED" : "CALLING",
      summary: input.simulate ? `Simulated call for ${office.providerName}; office not contacted.` : `Calling ${office.providerName}.`,
    });

    if (input.simulate) {
      const interpretedCall = canonicalAppointmentEnvelope(fakeDoctorCallStructuredOutput());
      const doctorResult = interpretedCall.result;
      const structuredOutput = interpretedCall.structuredOutput;
      const savedTimes = await saveVapiAppointmentOptions({
        userId: user.userId,
        requestId: saved.requestId,
        locationId: office.locationId,
        times: doctorResult.availableTimes,
        source: "DEMO",
      });
      const result = {
        ...doctorResult,
        availableTimes: doctorResult.availableTimes.map((time) => ({
          ...time,
          optionId: savedTimes.find((savedTime) => savedTime.startIso === time.startIso)?.optionId ?? "",
        })),
        savedForFollowUp: false,
      };
      const reply = formatRetrievedCall(office.providerName, [
        `Summary: ${result.summary}`,
        `Available times: ${result.availableTimes.map((time) => time.label).join("; ")}`,
        `Estimated cost: ${result.estimatedCost}`,
        `Insurance response: ${result.insuranceResponse}`,
        `Office requirements: ${result.officeRequirements.join("; ")}`,
        result.followUpNotes ? `Follow-up: ${result.followUpNotes}` : null,
      ].filter((line): line is string => Boolean(line)), true);
      await updateOfficeOutreach({
        userId: user.userId,
        attemptId,
        status: "COMPLETED",
        externalReference: `demo-${attemptId}`,
        summary: "Simulated call completed; office not contacted.",
        resultJson: JSON.stringify(structuredOutput),
      });
      const refreshedRequest = await findCareRequest(user.userId, saved.requestId);
      return {
        ok: true,
        message: "The fake demo call finished.",
        reply,
        callDraft: { ...baseDraft, workflow: "completed", resultText: reply, result },
        saved: refreshedRequest,
      };
    }

    try {
      const policies = input.paymentPreference === "insurance" ? await listInsurancePolicies(user.userId) : [];
      const policy = policies.find((item) => item.active) ?? policies[0];
      const created = await createVapiDoctorCall({
        officeName: office.providerName,
        officePhone: DEMO_CALL_DESTINATION,
        patientName: profile.fullName,
        patientPhone: profile.phoneE164,
        patientDateOfBirth: profile.dateOfBirth,
        patientAddress: [profile.addressLine1, profile.city, profile.region, profile.postalCode].filter(Boolean).join(", "),
        patientLanguage: profile.preferredLanguage,
        visitType: input.visitType,
        reason: input.reason || input.visitType,
        preferredTimes: input.timePreference,
        payment: input.paymentPreference,
        insurance: policy
          ? `${policy.payerName}; ${policy.planName}; member ${policy.memberId}`
          : "",
      });
      await updateOfficeOutreach({
        userId: user.userId,
        attemptId,
        status: "CALLING",
        externalReference: created.callId,
        summary: `Vapi is calling ${office.providerName}.`,
      });
      const call = await waitForDoctorCall(created.callId, created.assistantId);
      if (isDeclinedCall(call.status, call.endedReason)) {
        const outcome = declined();
        await updateOfficeOutreach({
          userId: user.userId,
          attemptId,
          status: "FAILED",
          externalReference: call.callId,
          summary: outcome.reply.slice(0, 500),
        });
        return outcome;
      }
      if (call.status.toLowerCase() === "failed") {
        const outcome = declined("unreachable");
        await updateOfficeOutreach({
          userId: user.userId,
          attemptId,
          status: "FAILED",
          externalReference: call.callId,
          summary: outcome.reply.slice(0, 500),
        });
        return outcome;
      }
      const interpretedCall = await summarizeDoctorCallWithAgent(call.structuredOutput, call.transcript);
      const doctorResult = interpretedCall?.result ?? null;
      const savedTimes = doctorResult
        ? await saveVapiAppointmentOptions({
            userId: user.userId,
            requestId: saved.requestId,
            locationId: office.locationId,
            times: doctorResult.availableTimes,
          })
        : [];
      const result = doctorResult
        ? {
            ...doctorResult,
            availableTimes: doctorResult.availableTimes.map((time) => ({
              ...time,
              optionId: savedTimes.find((savedTime) => savedTime.startIso === time.startIso)?.optionId ?? "",
            })),
            savedForFollowUp: false,
          }
        : null;
      const structuredSummary = interpretedCall ? JSON.stringify(interpretedCall.structuredOutput) : null;
      const transcript = call.transcript?.trim();
      const lines = result ? [
        `Summary: ${result.summary}`,
        `Available times: ${result.availableTimes.length ? result.availableTimes.map((time) => time.label).join("; ") : "None reported"}`,
        `Estimated cost: ${result.estimatedCost ?? "Not reported"}`,
        `Insurance response: ${result.insuranceResponse ?? "Not reported"}`,
        `Office requirements: ${result.officeRequirements.length ? result.officeRequirements.join("; ") : "None reported"}`,
        result.followUpNotes ? `Follow-up: ${result.followUpNotes}` : null,
        `Vapi call: ${call.callId}`,
      ].filter((line): line is string => Boolean(line)) : [
        `Outcome: ${call.endedReason ? call.endedReason.replaceAll("-", " ") : call.status}`,
        transcript ? `Transcript: ${transcript.slice(-2_000)}` : "Vapi did not return a transcript.",
        `Vapi call: ${call.callId}`,
      ].filter((line): line is string => Boolean(line));
      const reply = formatRetrievedCall(office.providerName, lines);
      await updateOfficeOutreach({
        userId: user.userId,
        attemptId,
        status: "COMPLETED",
        externalReference: call.callId,
        summary: (structuredSummary ?? transcript ?? `Vapi call completed: ${call.status}`).slice(0, 500),
        resultJson: structuredSummary,
      });
      const refreshedRequest = await findCareRequest(user.userId, saved.requestId);
      return {
        ok: true,
        message: "The doctor-office call finished.",
        reply,
        callDraft: { ...baseDraft, workflow: "completed", resultText: reply, result },
        saved: refreshedRequest,
      };
    } catch (error) {
      const detail = error instanceof ConfigurationError
        ? "Live doctor calls are not configured. Add the Vapi private key, doctor assistant ID, and outbound phone number ID on the server."
        : error instanceof Error ? error.message : "The doctor-office call could not be completed.";
      await updateOfficeOutreach({
        userId: user.userId,
        attemptId,
        status: "FAILED",
        summary: detail.slice(0, 500),
      }).catch(() => undefined);
      return failed(detail, { ...baseDraft, resultText: detail });
    }
  } catch (error) {
    console.error("Office call handoff failed", error);
    return failed("The call result could not be saved. Please try again.", baseDraft);
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
