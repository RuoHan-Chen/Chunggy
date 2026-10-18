import "server-only";

import { z } from "zod";

import { ConfigurationError } from "@/lib/env";
import { isDemoOfficeNumber } from "@/server/vapi/demo-offices";
import { normalizeInsuranceFindings, type InsuranceFindings } from "./insurance-findings";

export const VAPI_TEST_CALL_ID = process.env.VAPI_TEST_CALL_ID?.trim() || "01a14dbd-0832-7bb9-80ad-48ba4bdd52c9";
const VapiCallSchema = z.object({ id: z.string(), status: z.string().optional() }).passthrough();

export type VapiCallResult = {
  callId: string;
  status: string;
  durationSeconds: number | null;
  cost: number | null;
  transcript: string | null;
  completedAt: string | null;
  structuredOutput: unknown | null;
  structuredOutputStatus: "available" | "pending" | "missing" | "invalid";
  findings: InsuranceFindings | null;
  findingsStatus: "available" | "pending" | "missing" | "invalid";
  diagnostic: string | null;
  endedReason: string | null;
};

export class VapiApiError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = "VapiApiError";
  }
}

function apiConfig() {
  const apiKey = process.env.VAPI_PRIVATE_API_KEY?.trim();
  if (!apiKey) throw new ConfigurationError(["VAPI_PRIVATE_API_KEY"]);
  return { apiKey };
}

function doctorCallConfig() {
  const { apiKey } = apiConfig();
  const assistantId =
    process.env.VAPI_DOCTOR_ASSISTANT_ID?.trim() ||
    process.env.VAPI_APPOINTMENT_ASSISTANT_ID?.trim();
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID?.trim();
  if (!assistantId || !phoneNumberId) {
    throw new ConfigurationError([
      ...(!assistantId ? ["VAPI_DOCTOR_ASSISTANT_ID or VAPI_APPOINTMENT_ASSISTANT_ID"] : []),
      ...(!phoneNumberId ? ["VAPI_PHONE_NUMBER_ID"] : []),
    ]);
  }
  if (!z.uuid().safeParse(assistantId).success || !z.uuid().safeParse(phoneNumberId).success) {
    throw new ConfigurationError([
      ...(!z.uuid().safeParse(assistantId).success ? ["VAPI_DOCTOR_ASSISTANT_ID or VAPI_APPOINTMENT_ASSISTANT_ID"] : []),
      ...(!z.uuid().safeParse(phoneNumberId).success ? ["VAPI_PHONE_NUMBER_ID"] : []),
    ]);
  }
  return { apiKey, assistantId, phoneNumberId };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function isoDate(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export type VapiDoctorCallInput = {
  officeName: string;
  officePhone: string;
  patientName: string;
  patientPhone: string;
  patientDateOfBirth: string;
  patientAddress: string;
  patientLanguage: string;
  visitType: string;
  reason: string;
  preferredTimes: string;
  payment: string;
  insurance: string;
};

export async function createVapiDoctorCall(input: VapiDoctorCallInput) {
  const destination = input.officePhone.replace(/[^\d+]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(destination)) {
    throw new VapiApiError("The doctor's office needs a valid E.164 phone number before calling.", 400);
  }
  if (!isDemoOfficeNumber(destination)) {
    throw new VapiApiError("The doctor's office number is not approved for hackathon demo calls.", 403);
  }
  const { apiKey, assistantId, phoneNumberId } = doctorCallConfig();
  let response: Response;
  try {
    response = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `Assurance appointment outreach - ${input.officeName}`.slice(0, 100),
        assistantId,
        phoneNumberId,
        customer: { number: destination, name: input.officeName },
        assistantOverrides: {
          variableValues: {
            officeName: input.officeName,
            patientName: input.patientName,
            patientPhone: input.patientPhone,
            patientDateOfBirth: input.patientDateOfBirth,
            patientAddress: input.patientAddress,
            patientLanguage: input.patientLanguage,
            visitType: input.visitType,
            reason: input.reason,
            preferredTimes: input.preferredTimes,
            payment: input.payment,
            insurance: input.insurance || "Not provided",
            questions: "Ask about openings in the preferred times, expected cost, and what the patient should bring.",
          },
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    if (error instanceof VapiApiError) throw error;
    throw new VapiApiError("Could not reach Vapi to start the doctor-office call.");
  }
  if (!response.ok) {
    throw new VapiApiError(
      response.status === 401 || response.status === 403
        ? "Vapi rejected the configured private API key or outbound-call resources."
        : `Vapi could not start the doctor-office call (HTTP ${response.status}).`,
      response.status,
    );
  }
  const raw = await response.json().catch(() => null);
  const parsed = VapiCallSchema.safeParse(raw);
  if (!parsed.success) throw new VapiApiError("Vapi started the request but did not return a valid call ID.");
  return { callId: parsed.data.id, status: parsed.data.status ?? "queued", assistantId };
}

export async function getVapiCall(
  callId: string,
  options: { assistantId?: string; outputId?: string } = {},
): Promise<VapiCallResult> {
  const parsedId = z.uuid().safeParse(callId);
  if (!parsedId.success) throw new VapiApiError("Invalid Vapi call ID.", 400);
  const { apiKey } = apiConfig();
  const assistantId = options.assistantId ?? process.env.VAPI_ASSISTANT_ID?.trim();
  const outputId = options.outputId ?? process.env.VAPI_INSURANCE_OUTPUT_ID?.trim();

  let response: Response;
  try {
    response = await fetch(`https://api.vapi.ai/call/${encodeURIComponent(callId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new VapiApiError("Could not reach the Vapi API.");
  }
  if (!response.ok) {
    throw new VapiApiError(
      response.status === 401 || response.status === 403
        ? "Vapi rejected the configured private API key."
        : response.status === 404
          ? "Vapi call was not found."
          : `Vapi API returned HTTP ${response.status}.`,
      response.status,
    );
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new VapiApiError("Vapi returned an unreadable call response.");
  }
  const parsedCall = VapiCallSchema.safeParse(raw);
  if (!parsedCall.success || !isObject(raw)) {
    throw new VapiApiError("Vapi returned a call response with an unexpected shape.");
  }
  const call = raw;
  if (assistantId && typeof call.assistantId === "string" && call.assistantId !== assistantId) {
    throw new VapiApiError("The call does not belong to the configured Vapi assistant.", 403);
  }

  const artifact = isObject(call.artifact) ? call.artifact : {};
  const transcript = typeof artifact.transcript === "string"
    ? artifact.transcript
    : typeof call.transcript === "string" ? call.transcript : null;
  const structured = isObject(artifact.structuredOutputs) ? artifact.structuredOutputs : {};
  const output = outputId ? structured[outputId] : Object.values(structured)[0];
  const result = isObject(output) ? output.result : undefined;
  const terminal = ["ended", "completed", "failed"].includes(parsedCall.data.status ?? "");
  let structuredOutputStatus: VapiCallResult["structuredOutputStatus"] = "pending";
  let findings: InsuranceFindings | null = null;
  let findingsStatus: VapiCallResult["findingsStatus"] = "pending";
  let diagnostic: string | null = null;

  if (result !== undefined && result !== null) {
    structuredOutputStatus = "available";
    const normalized = normalizeInsuranceFindings(result);
    findings = normalized.findings;
    findingsStatus = findings ? "available" : "invalid";
    if (normalized.issues.length) {
      diagnostic = `Structured output was retrieved but does not match the CareBridge insurance findings schema: ${normalized.issues.join("; ")}`;
    }
  } else if (result === null) {
    structuredOutputStatus = "invalid";
    findingsStatus = "invalid";
    diagnostic = "Vapi returned a null structured result, indicating extraction did not produce findings.";
  } else if (!terminal) {
    structuredOutputStatus = "pending";
    findingsStatus = "pending";
    diagnostic = "Call processing is not complete; structured output may still be pending.";
  } else {
    structuredOutputStatus = "missing";
    findingsStatus = "missing";
    diagnostic = "No persisted result for this output ID. A dashboard preview may not be attached to the call artifact.";
  }

  const startedAt = isoDate(call.startedAt);
  const endedAt = isoDate(call.endedAt);
  const durationSeconds = typeof call.duration === "number" && Number.isFinite(call.duration) && call.duration >= 0
    ? call.duration
    : startedAt !== null && endedAt !== null && endedAt >= startedAt
      ? Math.round((endedAt - startedAt) / 1000)
      : null;
  const costs = Array.isArray(call.costs) ? call.costs : [];
  const costBreakdown = isObject(call.costBreakdown) ? call.costBreakdown.total : null;
  const costItems = costs
    .map((item) => isObject(item) ? nullableNumber(item.cost) : null)
    .filter((value): value is number => value !== null);
  const cost = nullableNumber(call.cost) ?? nullableNumber(costBreakdown) ??
    (costItems.length ? costItems.reduce((total, item) => total + item, 0) : null);

  return {
    callId,
    status: parsedCall.data.status ?? "unknown",
    durationSeconds,
    cost,
    transcript,
    completedAt: typeof call.endedAt === "string" ? call.endedAt : null,
    structuredOutput: result ?? null,
    structuredOutputStatus,
    findings,
    findingsStatus,
    diagnostic,
    endedReason: typeof call.endedReason === "string" ? call.endedReason : null,
  };
}
