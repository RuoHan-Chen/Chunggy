# How to set up Assurance

This guide takes a teammate from a fresh clone to the Google-protected Oracle dashboard. The application runs locally, but it connects to the shared Oracle Autonomous Database over an encrypted wallet connection.

## Architecture

```text
Browser
  |
  | Google login + application requests
  v
Next.js server (local machine or shared VM)
  |\
  | \-- Oracle user/password + wallet --> Oracle Autonomous Database
  |
  \---- OCI IAM request signing --------> OCI Generative AI
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
- An OCI user with an API signing key for local Generative AI calls
- An OCI compartment OCID, region, and supported on-demand model ID

OpenAI credentials are optional for the current login and database dashboard.

## 1. Clone and install

```bash
git clone https://github.com/RuoHan-Chen/Chunggy.git
cd Chunggy
```

If this pull request has not been merged yet, check out its branch:

```bash
git switch userflow-frontend-fixes
```

Then install dependencies with the repository's Node version:

```bash
nvm use
npm ci
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

# OCI Generative AI chatbot
OCI_GENAI_AUTH_MODE=config_file
OCI_GENAI_REGION=us-chicago-1
OCI_GENAI_COMPARTMENT_ID=YOUR_COMPARTMENT_OCID
OCI_GENAI_MODEL_ID=meta.llama-3.3-70b-instruct
# OCI_GENAI_CONFIG_FILE=/absolute/path/to/.oci/config
# OCI_GENAI_PROFILE=DEFAULT
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

## Configure OCI Generative AI

The proof-of-concept route uses the standard OCI Generative AI inference service shown in your Console. It does not require a Generative AI **Project** or `OCI_GENAI_API_KEY`.

### Local computer

1. Keep the Console region set to **US Midwest (Chicago)**.
2. Open your profile menu in the top-right, then **My profile** → **API keys** → **Add API key**.
3. Select **Generate API key pair**, download the private key, and click **Add**.
4. Copy Oracle's **Configuration File Preview** into `~/.oci/config`. Ensure its `key_file` points to the downloaded private key using an absolute path. This is an OCI API signing key, not the VM SSH key or database wallet.
5. Restrict both files:

   ```bash
   chmod 600 ~/.oci/config /absolute/path/to/oci_api_key.pem
   ```

6. In the Console, open **Identity & Security** → **Tenancy details** and copy the tenancy OCID. Because the current setup uses the root compartment (`jtafah (root)`), use that tenancy OCID as `OCI_GENAI_COMPARTMENT_ID`.
7. Open **Generative AI** → **Chat**, choose an on-demand model, and test it in the playground. Use the model ID shown by **View code** as `OCI_GENAI_MODEL_ID`. The template starts with `meta.llama-3.3-70b-instruct`; replace it if the playground offers a different ID.
8. Ask the tenancy administrator to grant your OCI group permission to use Generative AI if the playground or API returns `NotAuthorizedOrNotFound`.

If the config is at the default `~/.oci/config` path and uses the `DEFAULT` profile, leave `OCI_GENAI_CONFIG_FILE` and `OCI_GENAI_PROFILE` commented out. Each teammate should create their own API signing key instead of sharing the private key.

### OCI VM

Set `OCI_GENAI_AUTH_MODE=instance_principal` on the VM. Add the VM to an OCI dynamic group and grant that dynamic group permission to use Generative AI in the target compartment. The SDK then uses short-lived instance credentials automatically; no OCI user private key or config file belongs on the VM.

## 5. Start and verify

Apply the versioned schema and verify its Phase 0 tables and seed data:

```bash
npm run db:migrate
npm run db:verify
```

The migration command is idempotent, so teammates and deployments can run it after every pull. It stores completed versions in `SCHEMA_MIGRATIONS`. Phase 0 stores manually entered insurance fields only; it does not store uploaded card images.

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

Run the automated checks before opening a pull request:

```bash
npm test
npm run test:e2e
npm run lint
npm run build -- --webpack
```

After signing in, call the Oracle AI route from the browser console:

```js
const response = await fetch("/api/chat/oracle", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: "Explain what an Oracle wallet does." }),
});

console.log(await response.json());
```

A successful response has this shape:

```json
{
  "provider": "oci-generative-ai",
  "id": "response-id",
  "model": "configured-model-id",
  "text": "Model response"
}
```

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
| `OCI_GENAI_AUTH_MODE` | Yes | Use `config_file` locally and `instance_principal` on the OCI VM. |
| `OCI_GENAI_REGION` | Yes | It must support the selected model. |
| `OCI_GENAI_COMPARTMENT_ID` | Yes | The root compartment uses the tenancy OCID; another compartment uses its own OCID. |
| `OCI_GENAI_MODEL_ID` | Yes | Use an exact on-demand model ID supported in the selected region. |
| `OCI_GENAI_CONFIG_FILE` | Usually no | Each developer normally uses their own default `~/.oci/config`; omit it on the VM. |
| `OCI_GENAI_PROFILE` | Usually yes | `DEFAULT` works unless a developer uses a differently named local profile. |

The safest teammate workflow is:

1. Each teammate creates their own `.env.local`.
2. Each teammate downloads or securely receives the wallet and stores it outside the repository.
3. Each teammate sets their own `ORACLE_WALLET_LOCATION`.
4. Shared secrets are distributed through a password manager, not GitHub or chat.

## Shared VM setup

When Assurance runs on a VM, place the wallet on the VM and configure the VM's environment separately:

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
- Restrict them to the operating-system account that runs Assurance.
- Use one stable `AUTH_SECRET` for the deployed application.
- Use an Oracle application account with only the permissions Assurance needs.
- Run `npm ci`, `npm run build`, and `npm run start` during deployment.
- Put an HTTPS reverse proxy or load balancer in front of the Next.js server.
- Add the VM's public HTTPS callback URL to the Google OAuth client.
- Set `OCI_GENAI_AUTH_MODE=instance_principal`; do not copy a developer's OCI private key to the VM.
- Put the VM in a dynamic group and give that group permission to use Generative AI in the chosen compartment.

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

### The Oracle AI route returns `401`

Sign in through `/login` first. The POC route rejects requests without a valid Auth.js session.

### The Oracle AI route returns `503`

One or more `OCI_GENAI_*` environment variables is missing. Check the `missing` array in the response and restart the server after editing `.env.local`.

### The Oracle AI route returns `502`

OCI rejected or could not complete the upstream request. Locally, check `~/.oci/config`, its `key_file`, the API-key fingerprint, compartment OCID, model ID, region, and IAM permission. On the VM, check dynamic-group membership and the instance-principal IAM policy.

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
- [Oracle AI chatbot route](../src/app/api/chat/oracle/route.ts)
- [Project overview](../README.md)
