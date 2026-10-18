import { foundationMigration } from "./001-foundation";
import { careRequestMigration } from "./002-care-requests";
import { appointmentMigration } from "./003-appointments";
import type { Migration } from "./types";

export const migrations: Migration[] = [foundationMigration, careRequestMigration, appointmentMigration];
