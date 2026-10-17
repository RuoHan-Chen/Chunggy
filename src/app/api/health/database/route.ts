import { checkDatabaseConnection } from "@/lib/db";
import { ConfigurationError } from "@/lib/env";

export async function GET() {
  try {
    const connected = await checkDatabaseConnection();

    return Response.json(
      { status: connected ? "ok" : "error" },
      { status: connected ? 200 : 503 },
    );
  } catch (error) {
    if (error instanceof ConfigurationError) {
      return Response.json(
        {
          status: "not_configured",
          missing: error.missingVariables,
        },
        { status: 503 },
      );
    }

    console.error("Oracle database health check failed");
    return Response.json({ status: "error" }, { status: 503 });
  }
}
