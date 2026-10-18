import { foundationMigration } from "./001-foundation";
import type { Migration } from "./types";

export const migrations: Migration[] = [foundationMigration];
