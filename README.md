# Chunggy

Minimal setup plan for a Next.js app using Oracle Database, Google authentication, and the OpenAI API. Product logic is intentionally out of scope for this first commit.

## Quick implementation plan

1. Scaffold the Next.js application and install `oracledb`, Auth.js, and the OpenAI SDK.
2. Configure environment variables locally for Oracle, Google OAuth, and OpenAI.
3. Verify Oracle connectivity with `SELECT 1 FROM DUAL`.
4. Add Google sign-in and protect server routes.
5. Add a server-side OpenAI chat endpoint.
6. Persist users, conversations, and messages in Oracle.
7. Test authentication, chat, history retrieval, and per-user data isolation.

## Secrets still needed

Create a local `.env.local` later with:

```env
ORACLE_USER=
ORACLE_PASSWORD=
ORACLE_CONNECT_STRING=

AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

OPENAI_API_KEY=
```

If Oracle requires a wallet, configure its local path and credentials separately. Never commit `.env.local`, private keys, or Oracle wallet files.

## Current status

- Repository initialized with a concise implementation plan.
- Secret files and Oracle wallet artifacts are excluded from Git.
- Application scaffolding, integrations, and product logic are not included yet.

