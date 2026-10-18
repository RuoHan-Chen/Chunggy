export const DEMO_OFFICE_NUMBERS = [
  "+19172082802",
  "+18327578013",
] as const;

export const DEMO_CALL_DESTINATION = DEMO_OFFICE_NUMBERS[0];

const allowedOfficeNumbers = new Set<string>(DEMO_OFFICE_NUMBERS);

export function isDemoOfficeNumber(value: string | null | undefined): value is typeof DEMO_OFFICE_NUMBERS[number] {
  return typeof value === "string" && allowedOfficeNumbers.has(value);
}
