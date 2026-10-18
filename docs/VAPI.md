# Vapi insurance verification integration

## Environment

Set these server-side values in `.env.local`:

```env
VAPI_PRIVATE_API_KEY=
VAPI_ASSISTANT_ID=d10b0ec1-8313-46dc-9abc-b976626d8fd6
VAPI_INSURANCE_OUTPUT_ID=1d2f40c0-095e-4c13-9a28-2f58c5b94a16
VAPI_WEBHOOK_SECRET=
```

The assistant and structured-output IDs are identifiers, not credentials. Keep the private key and webhook secret out of browser variables and source control.

## Local read test

Start the app in development and request `GET http://localhost:3000/api/vapi/test`. It fetches only the configured synthetic test call; it does not accept a call ID parameter. The response includes call status, transcript, duration/cost when present, normalized findings, and a diagnostic when the output is pending, absent, or invalid. This route returns 404 outside development.

Vapi dashboard preview results may not be persisted to a call. If the route reports that no output is attached, use a newly completed call whose assistant has the configured structured output attached.

## Webhook setup

Deploy the app to a URL Vapi can reach and configure the assistant/server URL to send events to:

```text
https://YOUR_HOST/api/vapi/webhook
```

Subscribe to `end-of-call-report`. Configure a saved Vapi server credential using bearer authentication with the `Authorization` header and set its token to the same value as `VAPI_WEBHOOK_SECRET`. The handler also accepts the legacy `X-Vapi-Secret` header. Vapi server authentication credentials are attached for saved server URLs; if configuring a URL directly on a call, configure its `server.headers` explicitly. See [Vapi server authentication](https://docs.vapi.ai/server-url/server-authentication) and [server events](https://docs.vapi.ai/server-url/events).

The endpoint validates the event envelope, ignores unrelated event types, fetches finalized call data from Vapi, and retries brief post-call analysis delays. It returns `503` with `Retry-After` when results are still pending; Vapi retries server URL deliveries after a `5xx` response. It does not store webhook bodies or persist records.

For local webhook testing, expose port 3000 through a tunnel such as ngrok, then configure the tunnel URL in Vapi. Vapi's CLI listener can also forward deliveries to the local endpoint; see [Vapi local webhook testing](https://docs.vapi.ai/cli/webhook).

## Oracle and UI connection

The current Oracle schema has user profiles and insurance policies but no care-request workflow or Vapi-call-to-request mapping. The webhook therefore does not write an unassociated call or infer a patient from webhook data. Once a trusted call-to-care-request mapping is added to the existing workflow, persist the normalized findings idempotently through the current Oracle repository layer and expose them only to the authorized request owner. The existing insurance screen has no call reference to query, so it is not connected to synthetic test results.

Findings are the representative's reported information and should be verified with the insurer; the integration does not treat extracted values as guaranteed coverage.
