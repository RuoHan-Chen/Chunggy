import { foundationMigration } from "./001-foundation";
import { careRequestMigration } from "./002-care-requests";
import { appointmentMigration } from "./003-appointments";
import { conversationMigration } from "./004-conversations";
import { callHandoffMigration } from "./005-call-handoff";
import { hackathonCallResultsMigration } from "./006-hackathon-call-results";
import type { Migration } from "./types";

export const migrations: Migration[] = [
  foundationMigration,
  careRequestMigration,
  appointmentMigration,
  conversationMigration,
  callHandoffMigration,
  hackathonCallResultsMigration,
];
