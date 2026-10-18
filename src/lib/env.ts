export class ConfigurationError extends Error {
  constructor(public readonly missingVariables: string[]) {
    super(`Missing required environment variables: ${missingVariables.join(", ")}`);
    this.name = "ConfigurationError";
  }
}

function requireVariables<const T extends readonly string[]>(names: T) {
  const missing = names.filter((name) => !process.env[name]?.trim());

  if (missing.length > 0) {
    throw new ConfigurationError(missing);
  }

  return Object.fromEntries(
    names.map((name) => [name, process.env[name]!.trim()]),
  ) as { [K in T[number]]: string };
}

export function getOracleEnvironment() {
  return {
    ...requireVariables([
      "ORACLE_USER",
      "ORACLE_PASSWORD",
      "ORACLE_CONNECT_STRING",
    ] as const),
    walletLocation: process.env.ORACLE_WALLET_LOCATION?.trim(),
    walletPassword: process.env.ORACLE_WALLET_PASSWORD?.trim(),
  };
}

export function getOpenAIEnvironment() {
  return {
    ...requireVariables(["OPENAI_API_KEY"] as const),
    model: process.env.OPENAI_MODEL?.trim(),
  };
}

export function getOciGenerativeAiEnvironment() {
  const env = requireVariables([
    "OCI_GENAI_REGION",
    "OCI_GENAI_COMPARTMENT_ID",
    "OCI_GENAI_MODEL_ID",
  ] as const);
  const authMode = process.env.OCI_GENAI_AUTH_MODE?.trim() || "config_file";

  if (!/^[a-z0-9-]+$/.test(env.OCI_GENAI_REGION)) {
    throw new ConfigurationError(["OCI_GENAI_REGION"]);
  }

  if (authMode !== "config_file" && authMode !== "instance_principal") {
    throw new ConfigurationError(["OCI_GENAI_AUTH_MODE"]);
  }

  return {
    ...env,
    authMode,
    configFile: process.env.OCI_GENAI_CONFIG_FILE?.trim(),
    profile: process.env.OCI_GENAI_PROFILE?.trim() || "DEFAULT",
  };
}

export function getIntegrationStatus() {
  const isConfigured = (names: string[]) =>
    names.every((name) => Boolean(process.env[name]?.trim()));

  return {
    oracle: isConfigured([
      "ORACLE_USER",
      "ORACLE_PASSWORD",
      "ORACLE_CONNECT_STRING",
    ]),
    auth: isConfigured([
      "AUTH_SECRET",
      "AUTH_GOOGLE_ID",
      "AUTH_GOOGLE_SECRET",
    ]),
    openai: isConfigured(["OPENAI_API_KEY", "OPENAI_MODEL"]),
    oracleAi: isConfigured([
      "OCI_GENAI_REGION",
      "OCI_GENAI_COMPARTMENT_ID",
      "OCI_GENAI_MODEL_ID",
    ]),
    vapi:
      isConfigured(["VAPI_PRIVATE_API_KEY", "VAPI_PHONE_NUMBER_ID"]) &&
      Boolean(
        process.env.VAPI_DOCTOR_ASSISTANT_ID?.trim() ||
        process.env.VAPI_APPOINTMENT_ASSISTANT_ID?.trim(),
      ),
  };
}
