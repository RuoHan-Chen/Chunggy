import {
  paymentTitle,
  visitTypeLabel,
  type BookingStep,
  type CallDraft,
  type CallWorkflow,
  type Preferences,
  type Profile,
} from "@/lib/careway/model";

export function emptyCallDraft(): CallDraft {
  return {
    workflow: "gathering",
    reason: "",
    officeName: "",
    officePhone: "",
    locationId: "",
    resultText: "",
    declineCount: 0,
    result: null,
  };
}

export function parseCallDraft(value: string | null | undefined): CallDraft {
  if (!value) return emptyCallDraft();
  try {
    const parsed = JSON.parse(value) as Partial<CallDraft>;
    const workflows: CallWorkflow[] = ["gathering", "review", "calling", "completed", "failed"];
    return {
      workflow: workflows.includes(parsed.workflow as CallWorkflow) ? parsed.workflow as CallWorkflow : "gathering",
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
      officeName: typeof parsed.officeName === "string" ? parsed.officeName : "",
      officePhone: typeof parsed.officePhone === "string" ? parsed.officePhone : "",
      locationId: typeof parsed.locationId === "string" ? parsed.locationId : "",
      resultText: typeof parsed.resultText === "string" ? parsed.resultText : "",
      declineCount: typeof parsed.declineCount === "number" && parsed.declineCount > 0 ? Math.floor(parsed.declineCount) : 0,
      result: parsed.result && typeof parsed.result === "object" ? parsed.result : null,
    };
  } catch {
    return emptyCallDraft();
  }
}

export function workflowLabel(workflow: CallWorkflow) {
  if (workflow === "review") return "Ready for review";
  if (workflow === "calling") return "Calling";
  if (workflow === "completed") return "Call finished";
  if (workflow === "failed") return "Call failed";
  return "Gathering details";
}

export function isDeclinedCall(status: string, endedReason: string | null) {
  const reason = (endedReason ?? "").toLowerCase();
  const state = status.toLowerCase();
  if (state === "declined" || state === "busy") return true;
  return reason.includes("declin") || reason.includes("busy") || reason.includes("did-not-answer") || reason.includes("no-answer") || reason.includes("rejected");
}

export function declineResult(previousDeclines: number, officeName: string, kind: "declined" | "unreachable" = "declined") {
  const declineCount = previousDeclines + 1;
  const failed = declineCount >= 2;
  const reply = failed
    ? kind === "declined"
      ? `Call failed. ${officeName} declined the call twice, so no further call will be placed right now. Try again later.`
      : `Call failed. ${officeName} could not be reached after two tries, so no further call will be placed right now. Try again later.`
    : kind === "declined"
      ? `${officeName} declined the call. Confirm the brief to try one more time.`
      : `The call to ${officeName} did not go through. Confirm the brief to try one more time.`;
  return {
    declineCount,
    workflow: failed ? "failed" as const : "review" as const,
    reply,
  };
}

export function isSideQuestion(text: string) {
  const trimmed = text.trim();
  if (!trimmed || /^\d{5}$/.test(trimmed)) return false;
  return /\?/.test(trimmed) || /^(what|why|how|who|explain|define|tell me|can you explain)\b/i.test(trimmed);
}

export function isCallConfirmation(text: string) {
  return /^(confirm and call|confirm|yes, call|call this office|call the office|real vapi call|fake demo call)$/i.test(text.trim());
}

export function isFakeCallConfirmation(text: string) {
  return /^fake demo call$/i.test(text.trim());
}

export function detectReason(text: string) {
  return text.match(/\b(cleaning|checkup|check-up|pain|exam|physical|cavity|filling)\b/i)?.[1] ?? "";
}

export function resumeAfterSideQuestion(step: BookingStep, preferences: Preferences, draft: CallDraft) {
  const subject = preferences.visitType === "dental"
    ? "your dentist"
    : `your ${visitTypeLabel(preferences.visitType).toLowerCase()}`;
  return `To continue finding ${subject}, ${nextQuestion(step, draft)}`;
}

export function formatCallBrief(profile: Profile, preferences: Preferences, draft: CallDraft) {
  const reason = draft.reason || visitTypeLabel(preferences.visitType);
  const insurance = profile.payment === "insurance" && profile.insuranceCompany
    ? `${profile.insuranceCompany}${profile.planName ? ` · ${profile.planName}` : ""}${profile.memberId ? ` · member ${profile.memberId}` : ""}`
    : "";
  return [
    "Here is the call brief. Nothing is shared until you confirm.",
    "",
    `Patient: ${profile.fullName || "Name missing"}`,
    `Phone: ${profile.phone || "Phone missing"}`,
    `Date of birth: ${profile.dateOfBirth || "Date of birth missing"}`,
    `Visit: ${visitTypeLabel(preferences.visitType)}`,
    `Reason: ${reason}`,
    `Office: ${draft.officeName}`,
    `Office phone: ${displayPhone(draft.officePhone)}`,
    `Search: ${preferences.location}`,
    `Times: ${preferences.preferredTimes}`,
    "Flexibility: The requested times are preferred. The office may offer another time in the same week.",
    `Payment: ${paymentTitle(profile.payment)}`,
    insurance ? `Insurance on file: ${insurance}` : "Insurance: not included",
    "",
    "Questions for the office:",
    "- Is there an opening in the requested times?",
    "- What will this visit cost?",
    "- What should the patient bring?",
    "",
    "Catalog times and prices are estimates. Choose a real Vapi call or a fake demo call when this brief looks right.",
  ].join("\n");
}

export function formatRetrievedCall(officeName: string, lines: string[], simulated = false) {
  return [
    simulated
      ? `The fake demo call for ${officeName} has finished. The office was not contacted.`
      : `The call with ${officeName} has finished.`,
    "",
    ...lines,
    "",
    simulated
      ? "These are simulated demo results. The office was not contacted and the visit is not booked."
      : "This result came from the live Vapi call. Review the office's response before treating any time as confirmed; the visit is not booked yet.",
  ].join("\n");
}

export function displayPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (local.length !== 10) return value || "Not listed";
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

function nextQuestion(step: BookingStep, draft: CallDraft) {
  if (step === "visit") return "what kind of visit do you want?";
  if (step === "location") return "what ZIP should I search near?";
  if (step === "time") return "what time of day works best?";
  if (step === "payment") return "how do you want to pay?";
  if (draft.workflow === "review") return "confirm the call brief when it looks right.";
  return "which office should I call?";
}
