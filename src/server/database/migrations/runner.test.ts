import { describe, expect, it } from "vitest";

import type { Migration } from "./types";
import { migrationPlan } from "./runner";

const available: Migration[] = [
  { version: 2, name: "second", statements: [] },
  { version: 1, name: "first", statements: [] },
];

describe("migrationPlan", () => {
  it("orders migrations and separates applied work", () => {
    const plan = migrationPlan(available, new Map([[1, "first"]]));

    expect(plan.applied.map((migration) => migration.version)).toEqual([1]);
    expect(plan.pending.map((migration) => migration.version)).toEqual([2]);
  });

  it("rejects a changed migration name for an applied version", () => {
    expect(() => migrationPlan(available, new Map([[1, "renamed"]]))).toThrow(
      /was applied as renamed/,
    );
  });

  it("rejects duplicate versions", () => {
    expect(() =>
      migrationPlan(
        [
          ...available,
          { version: 1, name: "duplicate", statements: [] },
        ],
        new Map(),
      ),
    ).toThrow(/Duplicate migration version 1/);
  });
});
