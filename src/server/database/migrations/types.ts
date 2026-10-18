export type MigrationStatement = {
  sql: string;
  binds?: Record<string, string | number | Date | null>;
  ignoreOracleErrors?: number[];
};

export type Migration = {
  version: number;
  name: string;
  statements: MigrationStatement[];
};
