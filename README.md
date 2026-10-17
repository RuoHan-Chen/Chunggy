# Chunggy

Chunggy is a Next.js application foundation for Oracle Database, Google authentication, and the OpenAI API. This branch contains server setup only; product and healthcare workflow logic are intentionally out of scope.

## Current implementation

- [x] Next.js 16 App Router with TypeScript and ESLint
- [x] Secret-safe environment template and validation
- [x] Oracle connection pool using the default Thin mode
- [x] Oracle health endpoint running `SELECT 1 FROM DUAL`
- [x] Auth.js route wiring for Google OAuth
- [x] Google login page and authenticated Oracle dashboard
- [x] Read-only Oracle schema and table overview
- [x] Lazy, server-only OpenAI SDK client
- [x] Authenticated OCI Generative AI chatbot route
- [x] Integration readiness health endpoint
- [x] Oracle credentials and live connection verification
- [ ] Google OAuth sign-in verification
- [ ] OpenAI API key and live request verification
- [ ] Oracle-backed user and conversation persistence
- [ ] Authenticated chat endpoint and interface

## Run locally

Use Node.js 22.13 or newer.

```bash
nvm use
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with Google to open the protected database dashboard. The dashboard reads Oracle metadata on the server and never exposes database credentials or wallet files to the browser.

For wallet installation, Google OAuth setup, teammate onboarding, verification, troubleshooting, and shared VM deployment, follow the [complete setup guide](docs/SETUP.md).

## Environment variables

Fill in `.env.local` locally. Never commit it.

```env
# Oracle Database
ORACLE_USER=
ORACLE_PASSWORD=
ORACLE_CONNECT_STRING=
# ORACLE_WALLET_LOCATION=
# ORACLE_WALLET_PASSWORD=

# Google OAuth / Auth.js
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# OpenAI
OPENAI_API_KEY=
# OPENAI_MODEL=

# OCI Generative AI
OCI_GENAI_API_KEY=
OCI_GENAI_REGION=us-chicago-1
OCI_GENAI_PROJECT_ID=
OCI_GENAI_MODEL=
```

For Google OAuth, configure the development callback URL as `http://localhost:3000/api/auth/callback/google`.

## Server endpoints

| Endpoint | Purpose | Credentials required |
|---|---|---|
| `GET /api/health` | Reports which integrations are configured without exposing secrets | No |
| `GET /api/health/database` | Opens an Oracle connection and runs `SELECT 1 FROM DUAL` | Oracle |
| `GET/POST /api/auth/*` | Auth.js handlers for Google OAuth | Auth.js and Google |
| `GET /dashboard` | Authenticated, read-only Oracle schema overview | Auth.js, Google, and Oracle |
| `POST /api/chat/oracle` | Sends an authenticated prompt to OCI Generative AI | Auth.js and OCI Generative AI |

The OpenAI client is initialized only when it is first used, so missing API keys do not break local builds. The official SDK automatically reads server credentials, and this project keeps all OpenAI access out of browser code.

## Next implementation steps

1. Complete a Google sign-in and verify the authenticated dashboard.
2. Create a least-privilege Oracle application user for deployment.
3. Add `USERS`, `CONVERSATIONS`, and `MESSAGES` migrations.
4. Add an authenticated server route using the OpenAI Responses API.
5. Save and retrieve per-user conversation history.

## References

- [OpenAI JavaScript SDK](https://developers.openai.com/api/reference/typescript)
- [Auth.js Google provider](https://authjs.dev/getting-started/providers/google)
- [node-oracledb connection handling](https://node-oracledb.readthedocs.io/en/latest/user_guide/connection_handling.html)
