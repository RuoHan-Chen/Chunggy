import { auth } from "@/auth";
import { ConfigurationError } from "@/lib/env";
import { startVapiAppointmentCall, VapiApiError } from "@/server/vapi/client";

export async function POST() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const call = await startVapiAppointmentCall();
    return Response.json(call, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return Response.json({ error: "not_configured", missing: error.missingVariables }, { status: 503 });
    }
    if (error instanceof VapiApiError) {
      const status = error.statusCode === 429 ? 503 : 502;
      return Response.json({ error: error.message }, { status });
    }
    return Response.json({ error: "Could not start the appointment call." }, { status: 500 });
  }
}
