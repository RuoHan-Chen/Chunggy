import { foundationMigration } from "./001-foundation";
import { careRequestMigration } from "./002-care-requests";
import type { Migration } from "./types";

export const migrations: Migration[] = [foundationMigration, careRequestMigration];
