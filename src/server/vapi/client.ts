import "server-only";

import { z } from "zod";

import { ConfigurationError } from "@/lib/env";
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
};

export class VapiApiError extends Error {
  constructor(message: string, public readonly statusCode?: number) {
    super(message);
    this.name = "VapiApiError";
  }
}

function config() {
  const apiKey = process.env.VAPI_PRIVATE_API_KEY?.trim();
  if (!apiKey) throw new ConfigurationError(["VAPI_PRIVATE_API_KEY"]);
  const assistantId = process.env.VAPI_ASSISTANT_ID?.trim();
  const outputId = process.env.VAPI_INSURANCE_OUTPUT_ID?.trim();
  if (!assistantId || !outputId) {
    throw new ConfigurationError([
      ...(!assistantId ? ["VAPI_ASSISTANT_ID"] : []),
      ...(!outputId ? ["VAPI_INSURANCE_OUTPUT_ID"] : []),
    ]);
  }
  return { apiKey, assistantId, outputId };
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

export async function getVapiCall(callId: string): Promise<VapiCallResult> {
  const parsedId = z.uuid().safeParse(callId);
  if (!parsedId.success) throw new VapiApiError("Invalid Vapi call ID.", 400);
  const { apiKey, assistantId, outputId } = config();

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
  if (typeof call.assistantId === "string" && call.assistantId !== assistantId) {
    throw new VapiApiError("The call does not belong to the configured Vapi assistant.", 403);
  }

  const artifact = isObject(call.artifact) ? call.artifact : {};
  const transcript = typeof artifact.transcript === "string"
    ? artifact.transcript
    : typeof call.transcript === "string" ? call.transcript : null;
  const structured = isObject(artifact.structuredOutputs) ? artifact.structuredOutputs : {};
  const output = structured[outputId];
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
  };
}

export async function startVapiAppointmentCall(): Promise<{ callId: string; status: string }> {
  const apiKey = process.env.VAPI_PRIVATE_API_KEY?.trim();
  const assistantId = process.env.VAPI_APPOINTMENT_ASSISTANT_ID?.trim();
  const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID?.trim();
  const destinationNumber = process.env.VAPI_TEST_DESTINATION_NUMBER?.trim();
  const missing = [
    ...(!apiKey ? ["VAPI_PRIVATE_API_KEY"] : []),
    ...(!assistantId ? ["VAPI_APPOINTMENT_ASSISTANT_ID"] : []),
    ...(!phoneNumberId ? ["VAPI_PHONE_NUMBER_ID"] : []),
    ...(!destinationNumber ? ["VAPI_TEST_DESTINATION_NUMBER"] : []),
  ];
  if (missing.length) throw new ConfigurationError(missing);

  const assistantIdResult = z.uuid().safeParse(assistantId);
  const phoneNumberIdResult = z.uuid().safeParse(phoneNumberId);
  const destinationResult = z.string().regex(/^\+[1-9]\d{7,14}$/).safeParse(destinationNumber);
  if (!assistantIdResult.success || !phoneNumberIdResult.success || !destinationResult.success) {
    throw new ConfigurationError([
      ...(!assistantIdResult.success ? ["VAPI_APPOINTMENT_ASSISTANT_ID"] : []),
      ...(!phoneNumberIdResult.success ? ["VAPI_PHONE_NUMBER_ID"] : []),
      ...(!destinationResult.success ? ["VAPI_TEST_DESTINATION_NUMBER"] : []),
    ]);
  }

  let response: Response;
  try {
    response = await fetch("https://api.vapi.ai/call", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        assistantId,
        phoneNumberId,
        customer: { number: destinationNumber },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new VapiApiError("Could not reach the Vapi API to start the call.");
  }

  if (!response.ok) {
    throw new VapiApiError(
      response.status === 401 || response.status === 403
        ? "Vapi rejected the configured private API key or call configuration."
        : response.status === 429
          ? "Vapi is temporarily rate limiting call requests."
          : `Vapi could not start the call (HTTP ${response.status}).`,
      response.status,
    );
  }

  let raw: unknown;
  try {
    raw = await response.json();
  } catch {
    throw new VapiApiError("Vapi returned an unreadable call response.");
  }
  const call = z.object({ id: z.uuid(), status: z.string().optional() }).safeParse(raw);
  if (!call.success) throw new VapiApiError("Vapi did not return a valid call ID.");

  return { callId: call.data.id, status: call.data.status ?? "queued" };
}
