"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { removeInsuranceAction, saveInsuranceAction, saveProfileAction } from "@/app/care-actions";
import styles from "@/components/careway/careway.module.css";
import {
  bookingTurn, clock, inferBookingStep, locationLabel, paymentLabel,
  type Appointment, type CareBootstrap, type CareSaveResult, type CareSnapshot,
  type ChatMessage, type Notice, type Preferences, type Profile, type Slot,
} from "@/lib/careway/model";

export type CareUser = { name: string; email: string; image: string | null };

type CareContextValue = {
  ready: boolean; user: CareUser; dataMode: CareBootstrap["mode"]; dataMessage: string | null;
  saving: boolean; profile: Profile; preferences: Preferences; messages: ChatMessage[];
  bookingStep: CareSnapshot["bookingStep"]; draft: Slot | null; appointment: Appointment | null;
  notices: Notice[]; providerSlots: Slot[]; retryDatabase: () => void;
  updateProfile: (patch: Partial<Profile>) => void; updatePreferences: (patch: Partial<Preferences>) => void;
  deferOnboarding: () => Promise<CareSaveResult>; completeOnboarding: () => Promise<CareSaveResult>;
  saveProfile: () => Promise<CareSaveResult>; saveInsurance: () => Promise<CareSaveResult>;
  sendMessage: (text: string) => void; selectSlot: (slot: Slot) => void;
  bookDraft: (shareSms: boolean) => void; cancelAppointment: () => void;
  markNoticesRead: () => void; requestCoverage: () => void;
  clearInsurance: () => Promise<CareSaveResult>;
};

const CareContext = createContext<CareContextValue | null>(null);

export function CareProvider({ user, initialData, children }: { user: CareUser; initialData: CareBootstrap; children: ReactNode }) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initialData.snapshot);
  const [policyId, setPolicyId] = useState(initialData.insurancePolicyId);
  const [saving, setSaving] = useState(false);

  const value = useMemo<CareContextValue>(() => {
    const commit = (recipe: (current: CareSnapshot) => CareSnapshot) => setSnapshot(recipe);
    const sessionOnly = (message: string): CareSaveResult => ({ ok: true, persisted: false, message: `${message} Saved for this session only because Oracle is disconnected.` });
    async function persistProfile(status: "NOT_STARTED" | "DEFERRED" | "COMPLETE") {
      if (initialData.mode === "fallback") return sessionOnly("Profile updated.");
      setSaving(true);
      try { return await saveProfileAction(snapshot.profile, status); } finally { setSaving(false); }
    }

    return {
      ready: true, user, dataMode: initialData.mode, dataMessage: initialData.message, saving,
      profile: snapshot.profile, preferences: snapshot.preferences, messages: snapshot.messages,
      bookingStep: snapshot.bookingStep ?? inferBookingStep(snapshot.messages), draft: snapshot.draft,
      appointment: snapshot.appointment, notices: snapshot.notices, providerSlots: initialData.providerSlots,
      retryDatabase: () => router.refresh(),
      updateProfile(patch) {
        commit((current) => {
          const profile = { ...current.profile, ...patch };
          const preferences = { ...current.preferences };
          if (patch.zip !== undefined) preferences.location = locationLabel(profile.zip);
          if (patch.payment !== undefined) preferences.paymentLabel = paymentLabel(profile.payment);
          return { ...current, profile, preferences };
        });
      },
      updatePreferences: (patch) => commit((current) => ({ ...current, preferences: { ...current.preferences, ...patch } })),
      async deferOnboarding() {
        const result = await persistProfile("DEFERRED");
        if (result.ok) commit((current) => ({ ...current, profile: { ...current.profile, deferred: true } }));
        return result;
      },
      async completeOnboarding() {
        const profileResult = await persistProfile("COMPLETE");
        if (!profileResult.ok) return profileResult;
        if (snapshot.profile.payment === "insurance" && snapshot.profile.insuranceCompany) {
          const result = initialData.mode === "fallback" ? sessionOnly("Insurance updated.") : await saveInsuranceAction(snapshot.profile, policyId);
          if (!result.ok) return result;
          if (result.insurancePolicyId) setPolicyId(result.insurancePolicyId);
        }
        commit((current) => ({ ...current, profile: { ...current.profile, onboardingComplete: true, deferred: false }, notices: current.notices.map((notice) => notice.id === "welcome" ? { ...notice, read: true } : notice) }));
        return profileResult;
      },
      saveProfile: () => persistProfile(snapshot.profile.onboardingComplete ? "COMPLETE" : snapshot.profile.deferred ? "DEFERRED" : "NOT_STARTED"),
      async saveInsurance() {
        if (initialData.mode === "fallback") return sessionOnly("Insurance updated.");
        setSaving(true);
        try {
          const profileResult = await saveProfileAction(snapshot.profile, snapshot.profile.onboardingComplete ? "COMPLETE" : snapshot.profile.deferred ? "DEFERRED" : "NOT_STARTED");
          if (!profileResult.ok || snapshot.profile.payment !== "insurance") {
            return snapshot.profile.payment === "insurance" ? profileResult : { ...profileResult, message: "Payment preference saved to Oracle." };
          }
          const result = await saveInsuranceAction(snapshot.profile, policyId);
          if (result.insurancePolicyId) setPolicyId(result.insurancePolicyId);
          return result;
        } finally { setSaving(false); }
      },
      sendMessage(text) {
        const trimmed = text.trim(); if (!trimmed) return; const time = clock();
        commit((current) => {
          const turn = bookingTurn(trimmed, current.bookingStep ?? inferBookingStep(current.messages), current.preferences, current.profile);
          return { ...current, bookingStep: turn.step, preferences: turn.preferences, profile: { ...current.profile, zip: turn.zip, payment: turn.payment }, messages: [...current.messages, { id: `user-${Date.now()}`, role: "user", text: trimmed, time }, { id: `assistant-${Date.now()}`, role: "assistant", text: turn.reply, time }] };
        });
      },
      selectSlot: (slot) => commit((current) => ({ ...current, draft: slot })),
      bookDraft(shareSms) {
        commit((current) => {
          if (!current.draft) return current;
          const appointment = { ...current.draft, status: "confirmed" as const };
          return { ...current, appointment, notices: [{ id: `booked-${appointment.reference}`, title: `${appointment.provider} confirmed your visit`, body: `${appointment.longDate} at ${appointment.timeLabel}. Reference ${appointment.reference}.${shareSms ? " Text reminders are on." : ""}`, read: false }, ...current.notices] };
        });
      },
      cancelAppointment: () => commit((current) => current.appointment ? { ...current, appointment: { ...current.appointment, status: "cancelled" }, notices: [{ id: `cancel-${Date.now()}`, title: "Appointment cancelled", body: `${current.appointment.provider} is no longer on your schedule.`, read: false }, ...current.notices] } : current),
      markNoticesRead: () => commit((current) => ({ ...current, notices: current.notices.map((notice) => ({ ...notice, read: true })) })),
      requestCoverage: () => commit((current) => ({ ...current, profile: { ...current.profile, coverageStatus: "requested" } })),
      async clearInsurance() {
        const result = initialData.mode === "fallback" ? sessionOnly("Insurance removed.") : await removeInsuranceAction();
        if (result.ok) { setPolicyId(null); commit((current) => ({ ...current, profile: { ...current.profile, insuranceCompany: "", memberId: "", planName: "", cardFrontName: "", cardBackName: "", coverageStatus: "not_verified" } })); }
        return result;
      },
    };
  }, [initialData, policyId, router, saving, snapshot, user]);

  return <CareContext.Provider value={value}>
    {initialData.mode === "fallback" ? <div className={styles.dataBanner} role="status"><span>{initialData.message}</span><button onClick={() => router.refresh()} type="button">Retry database</button></div> : <div className={styles.dataConnected} role="status">Oracle connected</div>}
    {children}
  </CareContext.Provider>;
}

export function useCare() {
  const value = useContext(CareContext);
  if (!value) throw new Error("useCare must be used within CareProvider");
  return value;
}
