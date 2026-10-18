import {
  defaultSnapshot,
  isBookingStep,
  locationLabel,
  paymentLabel,
  type CareSnapshot,
} from "@/lib/careway/model";

const eventName = "careway-preview";

type CacheEntry = { raw: string | null; snapshot: CareSnapshot | null };

const cache = new Map<string, CacheEntry>();

export function previewKey(email: string) {
  return `careway:v3:${email}`;
}

export function samplePreview(name: string) {
  return defaultSnapshot(name);
}

export function eyeReadyPreview(name: string): CareSnapshot {
  const snapshot = defaultSnapshot(name);
  const zip = snapshot.profile.zip;
  const location = locationLabel(zip);
  const preferredTimes = "Weekday mornings";
  return {
    ...snapshot,
    profile: { ...snapshot.profile, onboardingComplete: true, payment: "self" },
    preferences: {
      visitType: "eye",
      location,
      preferredTimes,
      paymentLabel: paymentLabel("self"),
    },
    bookingStep: "ready",
    messages: [
      {
        id: "demo-user",
        role: "user",
        text: "I want to book an eye appointment.",
        time: "10:24 AM",
      },
      {
        id: "demo-assistant",
        role: "assistant",
        text: `I can look for eye visits ${location.toLowerCase()}, ${preferredTimes.toLowerCase()}, self-pay. I can show options when you’re ready.`,
        time: "10:24 AM",
      },
    ],
  };
}

export function readPreview(email: string): CareSnapshot | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(previewKey(email));
  const cached = cache.get(email);
  if (cached && cached.raw === raw) return cached.snapshot;
  const snapshot = parsePreview(raw);
  cache.set(email, { raw, snapshot });
  return snapshot;
}

export function writePreview(email: string, snapshot: CareSnapshot) {
  const raw = JSON.stringify(snapshot);
  window.localStorage.setItem(previewKey(email), raw);
  cache.set(email, { raw, snapshot });
  window.dispatchEvent(new Event(eventName));
}

export function clearPreview(email: string) {
  window.localStorage.removeItem(previewKey(email));
  cache.set(email, { raw: null, snapshot: null });
  window.dispatchEvent(new Event(eventName));
}

export function subscribePreview(email: string, onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === previewKey(email)) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(eventName, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(eventName, onChange);
  };
}

export function emptyPreview(): CareSnapshot | null {
  return null;
}

function parsePreview(raw: string | null): CareSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CareSnapshot;
    if (parsed.version !== 2 || !parsed.profile || !Array.isArray(parsed.messages)) return null;
    if (!isBookingStep(parsed.bookingStep)) return null;
    return parsed;
  } catch {
    return null;
  }
}
