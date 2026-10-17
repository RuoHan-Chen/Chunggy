# Chunggy

Chunggy is a Next.js application foundation for Oracle Database, Google authentication, and the OpenAI API. This branch contains server setup only; product and healthcare workflow logic are intentionally out of scope.

## Current implementation

- [x] Next.js 16 App Router with TypeScript and ESLint
- [x] Secret-safe environment template and validation
- [x] Oracle connection pool using the default Thin mode
- [x] Oracle health endpoint running `SELECT 1 FROM DUAL`
- [x] Auth.js route wiring for Google OAuth
- [x] Lazy, server-only OpenAI SDK client
- [x] Integration readiness health endpoint
- [ ] Oracle credentials and live connection verification
- [ ] Google OAuth credentials and sign-in verification
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

Open [http://localhost:3000](http://localhost:3000). The application can start without credentials; integrations report as unconfigured until their variables are supplied.

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
```

For Google OAuth, configure the development callback URL as `http://localhost:3000/api/auth/callback/google`.

## Server endpoints

| Endpoint | Purpose | Credentials required |
|---|---|---|
| `GET /api/health` | Reports which integrations are configured without exposing secrets | No |
| `GET /api/health/database` | Opens an Oracle connection and runs `SELECT 1 FROM DUAL` | Oracle |
| `GET/POST /api/auth/*` | Auth.js handlers for Google OAuth | Auth.js and Google |

The OpenAI client is initialized only when it is first used, so missing API keys do not break local builds. The official SDK automatically reads server credentials, and this project keeps all OpenAI access out of browser code.

## Next implementation steps

1. Add the supplied credentials and verify both health endpoints.
2. Complete a Google sign-in and persist the user in Oracle.
3. Add `USERS`, `CONVERSATIONS`, and `MESSAGES` migrations.
4. Add an authenticated server route using the OpenAI Responses API.
5. Save and retrieve per-user conversation history.

## References

- [OpenAI JavaScript SDK](https://developers.openai.com/api/reference/typescript)
- [Auth.js Google provider](https://authjs.dev/getting-started/providers/google)
- [node-oracledb connection handling](https://node-oracledb.readthedocs.io/en/latest/user_guide/connection_handling.html)
