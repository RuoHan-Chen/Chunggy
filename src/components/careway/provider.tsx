"use client";

import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import {
  bookingTurn,
  canonicalVisitType,
  clock,
  defaultSnapshot,
  inferBookingStep,
  isBookingStep,
  isLegacyBookingSeed,
  locationLabel,
  paymentLabel,
  seedMessages,
  type Appointment,
  type CareSnapshot,
  type ChatMessage,
  type Notice,
  type Preferences,
  type Profile,
  type Slot,
} from "@/lib/careway/model";

export type CareUser = {
  name: string;
  email: string;
  image: string | null;
};

type CareContextValue = {
  ready: boolean;
  user: CareUser;
  profile: Profile;
  preferences: Preferences;
  messages: ChatMessage[];
  bookingStep: CareSnapshot["bookingStep"];
  draft: Slot | null;
  appointment: Appointment | null;
  notices: Notice[];
  updateProfile: (patch: Partial<Profile>) => void;
  updatePreferences: (patch: Partial<Preferences>) => void;
  deferOnboarding: () => void;
  completeOnboarding: () => void;
  sendMessage: (text: string) => void;
  selectSlot: (slot: Slot) => void;
  bookDraft: (shareSms: boolean) => void;
  cancelAppointment: () => void;
  markNoticesRead: () => void;
  requestCoverage: () => void;
  clearInsurance: () => void;
};

const CareContext = createContext<CareContextValue | null>(null);

function storageKey(email: string) {
  return `careway:v3:${email || "preview"}`;
}

function loadSnapshot(email: string, name: string): CareSnapshot {
  const base = defaultSnapshot(name);
  try {
    const raw = localStorage.getItem(storageKey(email));
    if (!raw) {
      const language = localStorage.getItem("careway-language");
      if (language) base.profile.language = language;
      return base;
    }
    const parsed = JSON.parse(raw) as CareSnapshot;
    if (parsed.version !== 2 || !parsed.profile) return base;
    const legacySeed = isLegacyBookingSeed(parsed.messages ?? []);
    const messages = legacySeed
      ? seedMessages()
      : parsed.messages?.length
        ? parsed.messages
        : base.messages;
    const storedStep = typeof parsed.bookingStep === "string" && isBookingStep(parsed.bookingStep)
      ? parsed.bookingStep
      : inferBookingStep(messages);
    return {
      ...base,
      ...parsed,
      profile: {
        ...base.profile,
        ...parsed.profile,
        fullName: parsed.profile.fullName || name,
      },
      preferences: {
        ...base.preferences,
        ...parsed.preferences,
        visitType: canonicalVisitType(parsed.preferences?.visitType || base.preferences.visitType),
      },
      notices: parsed.notices?.length ? parsed.notices : base.notices,
      messages,
      bookingStep: legacySeed ? "location" : storedStep,
    };
  } catch {
    return base;
  }
}

const memory = new Map<string, CareSnapshot>();
const clientViews = new Map<string, { ready: true; snapshot: CareSnapshot }>();
const serverViews = new Map<string, { ready: false; snapshot: CareSnapshot }>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readStored(email: string, name: string) {
  const key = storageKey(email);
  const cached = memory.get(key);
  if (cached) return cached;
  const loaded = loadSnapshot(email, name);
  memory.set(key, loaded);
  return loaded;
}

function clientView(email: string, name: string) {
  const key = storageKey(email);
  const snapshot = readStored(email, name);
  const existing = clientViews.get(key);
  if (existing?.snapshot === snapshot) return existing;
  const view = { ready: true as const, snapshot };
  clientViews.set(key, view);
  return view;
}

function serverView(name: string) {
  const key = name || "guest";
  const existing = serverViews.get(key);
  if (existing) return existing;
  const view = { ready: false as const, snapshot: defaultSnapshot(name) };
  serverViews.set(key, view);
  return view;
}

function writeSnapshot(email: string, snapshot: CareSnapshot) {
  const key = storageKey(email);
  memory.set(key, snapshot);
  clientViews.set(key, { ready: true, snapshot });
  localStorage.setItem(key, JSON.stringify(snapshot));
  localStorage.setItem("careway-language", snapshot.profile.language);
  listeners.forEach((listener) => listener());
}

export function CareProvider({
  user,
  children,
}: {
  user: CareUser;
  children: ReactNode;
}) {
  const view = useSyncExternalStore(
    subscribe,
    () => clientView(user.email, user.name),
    () => serverView(user.name),
  );
  const snapshot = view.snapshot;
  const ready = view.ready;

  const value = useMemo<CareContextValue>(() => {
    function commit(recipe: (current: CareSnapshot) => CareSnapshot) {
      const current = memory.get(storageKey(user.email)) ?? snapshot;
      writeSnapshot(user.email, recipe(current));
    }

    return {
      ready,
      user,
      profile: snapshot.profile,
      preferences: snapshot.preferences,
      messages: snapshot.messages,
      bookingStep: snapshot.bookingStep ?? inferBookingStep(snapshot.messages),
      draft: snapshot.draft,
      appointment: snapshot.appointment,
      notices: snapshot.notices,
      updateProfile(patch) {
        commit((current) => {
          const profile = { ...current.profile, ...patch };
          const preferences = { ...current.preferences };
          if (patch.zip !== undefined) {
            preferences.location = locationLabel(profile.zip);
          }
          if (patch.payment !== undefined) {
            preferences.paymentLabel = paymentLabel(profile.payment);
          }
          if (patch.language) {
            profile.language = patch.language;
          }
          return { ...current, profile, preferences };
        });
      },
      updatePreferences(patch) {
        commit((current) => {
          const preferences = { ...current.preferences, ...patch };
          const profile = { ...current.profile };
          if (patch.paymentLabel === paymentLabel("insurance")) profile.payment = "insurance";
          if (patch.paymentLabel === paymentLabel("self")) profile.payment = "self";
          if (patch.paymentLabel === paymentLabel("later")) profile.payment = "later";
          return { ...current, preferences, profile };
        });
      },
      deferOnboarding() {
        commit((current) => ({
          ...current,
          profile: { ...current.profile, deferred: true },
        }));
      },
      completeOnboarding() {
        commit((current) => ({
          ...current,
          profile: { ...current.profile, onboardingComplete: true, deferred: false },
          notices: current.notices.map((notice) =>
            notice.id === "welcome" ? { ...notice, read: true } : notice,
          ),
        }));
      },
      sendMessage(text) {
        const trimmed = text.trim();
        if (!trimmed) return;
        const time = clock();
        commit((current) => {
          const turn = bookingTurn(
            trimmed,
            current.bookingStep ?? inferBookingStep(current.messages),
            current.preferences,
            current.profile,
          );
          return {
            ...current,
            bookingStep: turn.step,
            preferences: turn.preferences,
            profile: {
              ...current.profile,
              zip: turn.zip,
              payment: turn.payment,
            },
            messages: [
              ...current.messages,
              { id: `user-${Date.now()}`, role: "user", text: trimmed, time },
              { id: `assistant-${Date.now()}`, role: "assistant", text: turn.reply, time },
            ],
          };
        });
      },
      selectSlot(slot) {
        commit((current) => ({ ...current, draft: slot }));
      },
      bookDraft(shareSms) {
        commit((current) => {
          if (!current.draft) return current;
          const appointment = { ...current.draft, status: "confirmed" as const };
          return {
            ...current,
            appointment,
            notices: [
              {
                id: `booked-${appointment.reference}`,
                title: `${appointment.provider} confirmed your visit`,
                body: `${appointment.longDate} at ${appointment.timeLabel}. Reference ${appointment.reference}.${shareSms ? " Text reminders are on." : ""}`,
                read: false,
              },
              ...current.notices,
            ],
            messages: current.messages,
          };
        });
      },
      cancelAppointment() {
        commit((current) => {
          if (!current.appointment) return current;
          return {
            ...current,
            appointment: { ...current.appointment, status: "cancelled" },
            notices: [
              {
                id: `cancel-${Date.now()}`,
                title: "Appointment cancelled",
                body: `${current.appointment.provider} is no longer on your schedule.`,
                read: false,
              },
              ...current.notices,
            ],
          };
        });
      },
      markNoticesRead() {
        commit((current) => ({
          ...current,
          notices: current.notices.map((notice) => ({ ...notice, read: true })),
        }));
      },
      requestCoverage() {
        commit((current) => ({
          ...current,
          profile: { ...current.profile, coverageStatus: "requested" },
        }));
      },
      clearInsurance() {
        commit((current) => ({
          ...current,
          profile: {
            ...current.profile,
            insuranceCompany: "",
            memberId: "",
            planName: "",
            cardFrontName: "",
            cardBackName: "",
            coverageStatus: "not_verified",
          },
        }));
      },
    };
  }, [ready, snapshot, user]);

  return <CareContext.Provider value={value}>{children}</CareContext.Provider>;
}

export function useCare() {
  const value = useContext(CareContext);
  if (!value) {
    throw new Error("useCare must be used within CareProvider");
  }
  return value;
}
