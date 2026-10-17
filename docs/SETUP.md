# How to set up Chunggy

This guide takes a teammate from a fresh clone to the Google-protected Oracle dashboard. The application runs locally, but it connects to the shared Oracle Autonomous Database over an encrypted wallet connection.

## Architecture

```text
Browser
  |
  | Google login + application requests
  v
Next.js server (local machine or shared VM)
  |
  | Oracle user/password + wallet
  v
Oracle Autonomous Database
```

The browser never receives the Oracle password, wallet, or Google client secret. Only the Next.js server connects to Oracle.

## Prerequisites

Install or obtain:

- Git
- Node.js 22.13.0 or newer; the repository includes `.nvmrc`
- npm
- Access to the `RuoHan-Chen/Chunggy` repository
- An Oracle wallet ZIP for `HACKATHONADB`
- An Oracle database username and password
- The Google OAuth client ID and client secret
- Access to the Google OAuth test application if its consent screen is still in testing mode

OpenAI credentials are optional for the current login and database dashboard.

## 1. Clone and install

```bash
git clone https://github.com/RuoHan-Chen/Chunggy.git
cd Chunggy
nvm use
npm ci
```

If this pull request has not been merged yet, check out its branch:

```bash
git switch basic-server-setup
```

## 2. Extract the Oracle wallet

Keep the wallet outside the repository. On macOS, one suitable location is `Documents/oracle-wallets`:

```bash
wallet_dir="$HOME/Documents/oracle-wallets/Wallet_HACKATHONADB"
mkdir -p "$wallet_dir"
unzip "$HOME/Downloads/Wallet_HACKATHONADB.zip" -d "$wallet_dir"
chmod -R go-rwx "$wallet_dir"
printf '%s\n' "$wallet_dir"
```

The final command prints the absolute wallet path. Copy that path into `ORACLE_WALLET_LOCATION` in the next step.

The extracted directory should contain files including `tnsnames.ora`, `sqlnet.ora`, and `ewallet.pem`. Do not commit, email, or post these files in chat.

## 3. Create the local environment file

```bash
cp .env.example .env.local
openssl rand -base64 32
```

The second command generates a local `AUTH_SECRET`. Copy its output into `.env.local`, then fill in the remaining values:

```ini
# Oracle Database
ORACLE_USER=YOUR_ORACLE_DATABASE_USER
ORACLE_PASSWORD=YOUR_ORACLE_DATABASE_PASSWORD
ORACLE_CONNECT_STRING=hackathonadb_high
ORACLE_WALLET_LOCATION=/absolute/path/to/Wallet_HACKATHONADB
ORACLE_WALLET_PASSWORD=YOUR_WALLET_DOWNLOAD_PASSWORD

# Google OAuth / Auth.js
AUTH_SECRET=YOUR_GENERATED_RANDOM_VALUE
AUTH_GOOGLE_ID=YOUR_GOOGLE_OAUTH_CLIENT_ID
AUTH_GOOGLE_SECRET=YOUR_GOOGLE_OAUTH_CLIENT_SECRET

# Optional until an OpenAI feature is added
OPENAI_API_KEY=
OPENAI_MODEL=
```

The Oracle database password and wallet password are different:

- `ORACLE_PASSWORD` authenticates the database user.
- `ORACLE_WALLET_PASSWORD` unlocks the downloaded wallet.
- `ORACLE_USER` is a database account, not an Oracle Cloud email or VM SSH username.

For local setup, `ADMIN` works as `ORACLE_USER`, but the shared VM should use a limited application account instead.

## 4. Configure Google OAuth

In the Google Cloud OAuth 2.0 client, add this authorized redirect URI exactly:

```text
http://localhost:3000/api/auth/callback/google
```

If the OAuth consent screen is in testing mode, add each teammate's Google account as a test user. The team may use the same Google client ID and client secret for local development because every developer uses the same `localhost` callback. Store those values in `.env.local`, never in Git.

For deployment, also add the production callback using the real HTTPS hostname:

```text
https://YOUR_DOMAIN/api/auth/callback/google
```

## 5. Start and verify

Start the development server:

```bash
npm run dev
```

Verify the application and Oracle connection from another terminal:

```bash
curl http://localhost:3000/api/health
curl http://localhost:3000/api/health/database
```

The database check should return:

```json
{"status":"ok"}
```

Open [http://localhost:3000/login](http://localhost:3000/login), continue with Google, and confirm that `/dashboard` displays the Oracle database name, schema, service, database time, and available tables.

## Can teammates copy the same `.env.local`?

Not unchanged. Most shared values can be the same, but every computer has a different wallet path.

| Variable | Can teammates share the value? | Notes |
|---|---|---|
| `ORACLE_USER` | Technically yes | Prefer individual or limited application users; do not distribute `ADMIN` long-term. |
| `ORACLE_PASSWORD` | Technically yes | Share only through a password manager or another encrypted secret channel. |
| `ORACLE_CONNECT_STRING` | Yes | Use `hackathonadb_high` with this wallet. |
| `ORACLE_WALLET_LOCATION` | Usually no | Each teammate sets the absolute path on their own computer. |
| `ORACLE_WALLET_PASSWORD` | Yes, for the same wallet | It must match the downloaded wallet. |
| `AUTH_SECRET` | It can differ locally | Each developer can generate one; the deployed app needs one stable value across restarts and replicas. |
| `AUTH_GOOGLE_ID` | Yes | The OAuth client must allow the localhost callback. |
| `AUTH_GOOGLE_SECRET` | Yes | Treat it as a secret and never commit it. |
| `OPENAI_API_KEY` | Avoid sharing personal keys | Use a protected team/project key when OpenAI functionality is enabled. |

The safest teammate workflow is:

1. Each teammate creates their own `.env.local`.
2. Each teammate downloads or securely receives the wallet and stores it outside the repository.
3. Each teammate sets their own `ORACLE_WALLET_LOCATION`.
4. Shared secrets are distributed through a password manager, not GitHub or chat.

## Shared VM setup

When Chunggy runs on a VM, place the wallet on the VM and configure the VM's environment separately:

```ini
ORACLE_WALLET_LOCATION=/opt/chunggy/secrets/oracle-wallet
```

The shared flow becomes:

```text
Teammates -> GitHub -> Next.js app on VM -> Oracle Autonomous Database
Users     -> HTTPS  -> Next.js app on VM
```

On the VM:

- Store the wallet and environment file outside the Git checkout.
- Restrict them to the operating-system account that runs Chunggy.
- Use one stable `AUTH_SECRET` for the deployed application.
- Use an Oracle application account with only the permissions Chunggy needs.
- Run `npm ci`, `npm run build`, and `npm run start` during deployment.
- Put an HTTPS reverse proxy or load balancer in front of the Next.js server.
- Add the VM's public HTTPS callback URL to the Google OAuth client.

Teammates who only use the deployed application do not need local wallet files. Teammates running their own local Next.js server still need a local wallet path.

## Troubleshooting

### Google reports `redirect_uri_mismatch`

Add the exact callback URL shown in the error to the Google OAuth client's authorized redirect URIs. Local development uses `http://localhost:3000/api/auth/callback/google`.

### Google says the application is unavailable or access is blocked

If the consent screen is in testing mode, add the teammate's Google email under OAuth test users.

### The health endpoint reports `not_configured`

Check the `missing` array in the JSON response and add those names to `.env.local`. Restart `npm run dev` after changing environment variables.

### The database health endpoint returns `503`

Check that:

- The five Oracle values are present in `.env.local`.
- `ORACLE_WALLET_LOCATION` is an absolute path to the extracted directory, not the ZIP file.
- `ORACLE_CONNECT_STRING` matches an alias in `tnsnames.ora`.
- The database password and wallet password are entered in the correct fields.
- The Oracle Autonomous Database is running and reachable.

### The app starts on port 3001

Another process already owns port 3000. Stop the other development server before testing Google OAuth, because the configured local callback expects port 3000.

## Secret handling rules

- Never commit `.env`, `.env.local`, wallet ZIPs, extracted wallet files, private keys, or passwords.
- Never prefix a browser-visible environment variable with `NEXT_PUBLIC_` if it contains a secret.
- Keep database access in Server Components, Server Actions, and route handlers.
- Rotate a secret immediately if it is pasted into an issue, pull request, commit, screenshot, or public message.

## Related files

- [Environment template](../.env.example)
- [Authentication configuration](../src/auth.ts)
- [Oracle connection code](../src/lib/db.ts)
- [Authenticated dashboard](../src/app/dashboard/page.tsx)
- [Project overview](../README.md)
