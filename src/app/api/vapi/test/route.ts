import { ConfigurationError } from "@/lib/env";
import { getVapiCall, VAPI_TEST_CALL_ID, VapiApiError } from "@/server/vapi/client";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "The Vapi test endpoint is available only in development." }, { status: 404 });
  }

  try {
    const call = await getVapiCall(VAPI_TEST_CALL_ID);
    return Response.json(call, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof VapiApiError ? error.statusCode ?? 502
      : error instanceof ConfigurationError ? 503 : 502;
    return Response.json({
      error: error instanceof Error ? error.message : "Unable to load the configured Vapi test call.",
      callId: VAPI_TEST_CALL_ID,
    }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
