import { expect, test } from "@playwright/test";

test("public health endpoint reports integration readiness without secrets", async ({
  request,
}) => {
  const response = await request.get("/api/health");

  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body).toMatchObject({
    status: "ok",
    integrations: {
      oracle: expect.any(Boolean),
      auth: expect.any(Boolean),
      openai: expect.any(Boolean),
      oracleAi: expect.any(Boolean),
    },
    uptimeSeconds: expect.any(Number),
  });
  expect(JSON.stringify(body)).not.toContain("ORACLE_PASSWORD");
  expect(JSON.stringify(body)).not.toContain("AUTH_SECRET");
});
