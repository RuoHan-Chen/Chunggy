# Vapi doctor-office calling

## Environment

Set these server-side values in `.env.local`:

```env
VAPI_PRIVATE_API_KEY=
VAPI_PHONE_NUMBER_ID=
VAPI_DOCTOR_ASSISTANT_ID=
# Optional:
VAPI_DOCTOR_OUTPUT_ID=
VAPI_WEBHOOK_SECRET=
```

Import an outbound-capable phone number in Vapi and use its ID for
`VAPI_PHONE_NUMBER_ID`. Free Vapi numbers cannot make outbound calls. Keep the
private key and webhook secret out of browser variables and source control.

## Doctor assistant

Configure the saved assistant to use these dynamic variables:

```text
{{officeName}}
{{patientName}}
{{patientPhone}}
{{patientDateOfBirth}}
{{patientAddress}}
{{patientLanguage}}
{{visitType}}
{{reason}}
{{preferredTimes}}
{{payment}}
{{insurance}}
{{questions}}
```

The assistant should identify itself as an automated scheduling assistant,
state that the patient authorized the call, ask only about scheduling the
specified visit, and collect available times, expected cost, and preparation
instructions. It must not claim that insurance is verified or accept a booking
outside the patient's stated preferences. Attach an optional structured output
and set its ID as `VAPI_DOCTOR_OUTPUT_ID`.

Use this structured-output shape:

```json
{
  "available_times": [
    {
      "label": "Tuesday, October 20 at 10:30 AM",
      "start": "2026-10-20T15:30:00.000Z",
      "end": "2026-10-20T16:15:00.000Z"
    }
  ],
  "estimated_cost": "$120–$180",
  "insurance_response": "The office will verify benefits before the visit.",
  "office_requirements": ["Bring a photo ID", "Arrive 15 minutes early"],
  "follow_up_notes": "Optional notes",
  "summary": "The office reported one matching opening."
}
```

The app sends `POST https://api.vapi.ai/call` only after the user reviews the
brief and selects **Confirm and call**. The destination is the selected
provider's E.164 phone number loaded again from Oracle. The browser never
supplies the destination to the call action. The server only permits
`+19172082802` and `+18327578013`; missing or different provider numbers are
blocked before Vapi is invoked. The server polls the call until it ends, stores
the Vapi call ID on the outreach attempt, and returns the transcript or
structured output to the signed-in user. A returned time is still presented as
an office response. Selecting it creates a pending appointment request; it is
not treated as confirmed until the office confirms it.

## Legacy insurance read test

`VAPI_ASSISTANT_ID`, `VAPI_INSURANCE_OUTPUT_ID`, and `VAPI_TEST_CALL_ID` remain
available for the development-only `GET /api/vapi/test` read test.

## Webhook setup

Deploy the app to a URL Vapi can reach and configure the assistant/server URL to send events to:

```text
https://YOUR_HOST/api/vapi/webhook
```

Subscribe to `end-of-call-report`. Configure a saved Vapi server credential using bearer authentication with the `Authorization` header and set its token to the same value as `VAPI_WEBHOOK_SECRET`. The handler also accepts the legacy `X-Vapi-Secret` header. Vapi server authentication credentials are attached for saved server URLs; if configuring a URL directly on a call, configure its `server.headers` explicitly. See [Vapi server authentication](https://docs.vapi.ai/server-url/server-authentication) and [server events](https://docs.vapi.ai/server-url/events).

The endpoint validates the event envelope, ignores unrelated event types, fetches finalized call data from Vapi, and retries brief post-call analysis delays. It returns `503` with `Retry-After` when results are still pending; Vapi retries server URL deliveries after a `5xx` response. The confirmed-call action currently persists the call ID and final summary directly.

For local webhook testing, expose port 3000 through a tunnel such as ngrok, then configure the tunnel URL in Vapi. Vapi's CLI listener can also forward deliveries to the local endpoint; see [Vapi local webhook testing](https://docs.vapi.ai/cli/webhook).

The webhook read path does not independently update outreach attempts because
the webhook payload is not trusted to infer a user. The synchronous confirmed
call path associates the call with the authenticated user's care request.
