import { connection } from "next/server";

import { getIntegrationStatus } from "@/lib/env";

export async function GET() {
  await connection();

  return Response.json({
    status: "ok",
    integrations: getIntegrationStatus(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
}
