import { describe, expect, it } from "vitest";

import { DEMO_OFFICE_NUMBERS, isDemoOfficeNumber } from "./demo-offices";

describe("hackathon office allowlist", () => {
  it("contains only the two approved destination numbers", () => {
    expect(DEMO_OFFICE_NUMBERS).toEqual(["+19172082802", "+18327578013"]);
  });

  it("blocks missing and unapproved destinations", () => {
    expect(isDemoOfficeNumber("+19172082802")).toBe(true);
    expect(isDemoOfficeNumber("+18327578013")).toBe(true);
    expect(isDemoOfficeNumber("+13125550141")).toBe(false);
    expect(isDemoOfficeNumber(null)).toBe(false);
  });
});
