import { timingSafeEqual } from "node:crypto";
import { z } from "zod";

import { getVapiCall, VapiApiError } from "@/server/vapi/client";

const EventSchema = z.object({
  message: z.object({
    type: z.string(),
    call: z.object({ id: z.uuid() }).passthrough().optional(),
  }).passthrough(),
}).passthrough();

function authorized(request: Request): boolean | null {
  const secret = process.env.VAPI_WEBHOOK_SECRET?.trim();
  if (!secret) return null;
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const supplied = bearer ?? request.headers.get("x-vapi-secret");
  if (!supplied) return false;
  const expectedBuffer = Buffer.from(secret);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export async function POST(request: Request) {
  const authResult = authorized(request);
  if (authResult === null) {
    return Response.json({ error: "Webhook authentication is not configured." }, { status: 503 });
  }
  if (!authResult) return Response.json({ error: "Unauthorized." }, { status: 401 });

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1_000_000) return Response.json({ error: "Payload too large." }, { status: 413 });
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return Response.json({ error: "Could not read request body." }, { status: 400 });
  }
  if (raw.length > 1_000_000) return Response.json({ error: "Payload too large." }, { status: 413 });
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Malformed JSON payload." }, { status: 400 });
  }
  const parsed = EventSchema.safeParse(json);
  if (!parsed.success) return Response.json({ error: "Invalid Vapi event payload." }, { status: 400 });

  const { message } = parsed.data;
  if (message.type !== "end-of-call-report") {
    return Response.json({ received: true, ignored: true, eventType: message.type });
  }
  const callId = message.call?.id;
  if (!callId) return Response.json({ error: "End-of-call report is missing call.id." }, { status: 400 });

  // Analysis can finish just after the report. Retry reads briefly; a 503 lets
  // configured webhook delivery retry the event without persisting partial data.
  for (const delay of [0, 500, 1200]) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      const call = await getVapiCall(callId);
      if (call.findingsStatus === "pending" || call.findingsStatus === "missing") {
        if (delay !== 1200) continue;
        return Response.json({ received: false, status: call.findingsStatus, diagnostic: call.diagnostic }, {
          status: 503,
          headers: { "Retry-After": "3", "Cache-Control": "no-store" },
        });
      }
      // Read and normalize only. Oracle has no care-request/call mapping yet,
      // so there is no trusted record to persist or user to associate here.
      return Response.json({
        received: true,
        callId: call.callId,
        callStatus: call.status,
        structuredOutputStatus: call.structuredOutputStatus,
        structuredOutput: call.structuredOutput,
        findingsStatus: call.findingsStatus,
        findings: call.findings,
      }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      if (error instanceof VapiApiError && error.statusCode !== undefined && error.statusCode < 500) {
        return Response.json({ error: error.message }, { status: error.statusCode });
      }
      if (delay === 1200) {
        return Response.json({ error: "Could not retrieve finalized call data from Vapi." }, {
          status: 503,
          headers: { "Retry-After": "3", "Cache-Control": "no-store" },
        });
      }
    }
  }
  return Response.json({ error: "Call processing is pending." }, { status: 503, headers: { "Retry-After": "3" } });
}
