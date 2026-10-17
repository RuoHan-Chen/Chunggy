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
    openai: isConfigured(["OPENAI_API_KEY"]),
  };
}
