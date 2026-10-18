"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { removeInsuranceAction, saveInsuranceAction, saveProfileAction, syncCareRequestAction } from "@/app/care-actions";
import styles from "@/components/careway/careway.module.css";
import {
  bookingTurn,
  chatFromSnapshot,
  chatTitleFromMessage,
  clock,
  emptyChatSession,
  locationLabel,
  paymentLabel,
  type Appointment,
  type CareBootstrap,
  type CareSaveResult,
  type CareSnapshot,
  type ChatContextItem,
  type ChatMessage,
  type ChatProvider,
  type ChatSession,
  type Notice,
  type Preferences,
  type Profile,
  type SavedCareRequest,
  type Slot,
} from "@/lib/careway/model";
import { emptyPreview, readPreview, subscribePreview, writePreview } from "@/lib/careway/preview";

export type CareUser = { name: string; email: string; image: string | null };

type CareContextValue = {
  ready: boolean; user: CareUser; dataMode: CareBootstrap["mode"]; dataMessage: string | null;
  saving: boolean; profile: Profile; preferences: Preferences; messages: ChatMessage[];
  bookingStep: CareSnapshot["bookingStep"]; draft: Slot | null; appointment: Appointment | null;
  notices: Notice[]; providerSlots: Slot[]; savedCareRequest: SavedCareRequest | null; retryDatabase: () => void;
  chatSessions: ChatSession[]; activeChatId: string; activeChat: ChatSession;
  createChat: () => void; switchChat: (id: string) => void;
  renameChat: (id: string, title: string) => void; deleteChat: (id: string) => void;
  setChatProvider: (provider: ChatProvider) => void;
  importAppointmentContext: () => void; importChatContext: (id: string) => void;
  importSavedRequest: () => void; prepareCareRequest: () => Promise<CareSaveResult>;
  updateProfile: (patch: Partial<Profile>) => void; updatePreferences: (patch: Partial<Preferences>) => void;
  deferOnboarding: () => Promise<CareSaveResult>; completeOnboarding: () => Promise<CareSaveResult>;
  saveProfile: () => Promise<CareSaveResult>; saveInsurance: () => Promise<CareSaveResult>;
  sendMessage: (text: string) => Promise<void>; selectSlot: (slot: Slot) => void;
  bookDraft: (shareSms: boolean) => void; cancelAppointment: () => void;
  markNoticesRead: () => void; requestCoverage: () => void;
  clearInsurance: () => Promise<CareSaveResult>;
};

const CareContext = createContext<CareContextValue | null>(null);

function nextChatId() {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function summarizeChat(session: ChatSession) {
  const summary = session.messages
    .slice(-2)
    .map((message) => `${message.role === "user" ? "You" : "Assistant"}: ${message.text}`)
    .join(" · ");
  return summary || "This conversation does not have any messages yet.";
}

function appointmentContext(appointment: Appointment): ChatContextItem {
  return {
    id: `appointment-${appointment.reference}`,
    kind: "appointment",
    title: `${appointment.visitType} appointment`,
    body: `${appointment.provider} · ${appointment.longDate} at ${appointment.timeLabel} · ${appointment.status}`,
  };
}

type ChatApiResponse = {
  error?: string;
  message?: string;
  text?: string;
  model?: string;
};

function providerEndpoint(provider: ChatProvider) {
  return provider === "openai" ? "/api/chat/openai" : "/api/chat/oracle";
}

function providerLabel(provider: ChatProvider) {
  return provider === "openai" ? "GPT" : "OCI Generative AI";
}

function describeChatError(status: number, payload: ChatApiResponse, provider: ChatProvider) {
  if (payload.message) return payload.message;
  if (status === 401 || payload.error === "unauthorized") return "Your session expired. Sign in again and retry.";
  if (payload.error === "not_configured") return `${providerLabel(provider)} is not configured on this server.`;
  if (status === 502 || payload.error === "upstream_error") return `${providerLabel(provider)} rejected the request. Try again.`;
  return "The assistant could not complete that request. Try again.";
}

export function CareProvider({ user, initialData, children }: { user: CareUser; initialData: CareBootstrap; children: ReactNode }) {
  const router = useRouter();
  const [sessionSnapshot, setSessionSnapshot] = useState(initialData.snapshot);
  const [policyId, setPolicyId] = useState(initialData.insurancePolicyId);
  const [savedCareRequest, setSavedCareRequest] = useState(initialData.savedCareRequest);
  const [saving, setSaving] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => [chatFromSnapshot(initialData.snapshot)]);
  const [activeChatId, setActiveChatId] = useState("chat-initial");
  const [previewApplied, setPreviewApplied] = useState(false);
  const subscribe = useCallback(
    (onChange: () => void) => subscribePreview(user.email, onChange),
    [user.email],
  );
  const readStoredPreview = useCallback(() => readPreview(user.email), [user.email]);
  const preview = useSyncExternalStore(subscribe, readStoredPreview, emptyPreview);
  const snapshot = preview ?? sessionSnapshot;

  useEffect(() => {
    if (!preview || previewApplied) return;
    const previewChat = chatFromSnapshot(preview, "chat-preview");
    setChatSessions([previewChat]);
    setActiveChatId(previewChat.id);
    setPreviewApplied(true);
  }, [preview, previewApplied]);

  const activeChat = chatSessions.find((session) => session.id === activeChatId) ?? chatSessions[0];

  const value = useMemo<CareContextValue>(() => {
    const commit = (recipe: (current: CareSnapshot) => CareSnapshot) => {
      const stored = readPreview(user.email);
      if (stored) {
        writePreview(user.email, recipe(stored));
        return;
      }
      setSessionSnapshot(recipe);
    };
    const updateChat = (id: string, recipe: (current: ChatSession) => ChatSession) => {
      setChatSessions((current) => current.map((session) => session.id === id ? recipe(session) : session));
    };
    const updateActiveChat = (recipe: (current: ChatSession) => ChatSession) => {
      updateChat(activeChat.id, recipe);
    };
    const sessionOnly = (message: string): CareSaveResult => ({ ok: true, persisted: false, message: `${message} Saved for this session only because Oracle is disconnected.` });
    async function persistProfile(status: "NOT_STARTED" | "DEFERRED" | "COMPLETE") {
      if (initialData.mode === "fallback") return sessionOnly("Profile updated.");
      setSaving(true);
      try { return await saveProfileAction(snapshot.profile, status); } finally { setSaving(false); }
    }

    return {
      ready: true, user, dataMode: initialData.mode, dataMessage: initialData.message, saving,
      profile: snapshot.profile, preferences: activeChat.preferences, messages: activeChat.messages,
      bookingStep: activeChat.bookingStep, draft: snapshot.draft,
      appointment: snapshot.appointment, notices: snapshot.notices, providerSlots: initialData.providerSlots,
      savedCareRequest,
      chatSessions, activeChatId: activeChat.id, activeChat,
      retryDatabase: () => router.refresh(),
      createChat() {
        const session = emptyChatSession(snapshot.profile, nextChatId());
        setChatSessions((current) => [session, ...current]);
        setActiveChatId(session.id);
      },
      switchChat: setActiveChatId,
      setChatProvider(provider) {
        if (activeChat.pending) return;
        updateActiveChat((session) => ({ ...session, provider, error: null }));
      },
      renameChat(id, title) {
        const trimmed = title.trim();
        if (!trimmed) return;
        setChatSessions((current) => current.map((session) => session.id === id ? { ...session, title: trimmed, updatedAt: new Date().toISOString() } : session));
      },
      deleteChat(id) {
        const remaining = chatSessions.filter((session) => session.id !== id);
        if (remaining.length === 0) {
          const replacement = emptyChatSession(snapshot.profile, nextChatId());
          setChatSessions([replacement]);
          setActiveChatId(replacement.id);
          return;
        }
        setChatSessions(remaining);
        if (activeChat.id === id) setActiveChatId(remaining[0].id);
      },
      importAppointmentContext() {
        if (!snapshot.appointment) return;
        const item = appointmentContext(snapshot.appointment);
        updateActiveChat((session) => session.context.some((context) => context.id === item.id)
          ? session
          : { ...session, context: [...session.context, item], updatedAt: new Date().toISOString() });
      },
      importSavedRequest() {
        if (!savedCareRequest) return;
        const optionSummary = savedCareRequest.options
          .map((option) => `${option.provider} ${option.dateLabel} ${option.timeLabel}`)
          .join("; ");
        const item: ChatContextItem = {
          id: `care-request-${savedCareRequest.requestId}`,
          kind: "care_request",
          title: `${savedCareRequest.visitType} request`,
          body: [
            savedCareRequest.postalCode ? `Near ${savedCareRequest.postalCode} within ${savedCareRequest.radiusMiles} miles` : "Location not set",
            savedCareRequest.timePreference,
            savedCareRequest.paymentPreference,
            optionSummary ? `Options: ${optionSummary}` : "No matching options",
          ].filter(Boolean).join(" · "),
        };
        updateActiveChat((session) => session.context.some((context) => context.id === item.id)
          ? session
          : { ...session, context: [...session.context, item], updatedAt: new Date().toISOString() });
      },
      async prepareCareRequest() {
        if (initialData.mode === "fallback") return sessionOnly("Search kept in this session.");
        setSaving(true);
        try {
          const result = await syncCareRequestAction({
            requestId: savedCareRequest?.requestId,
            visitType: activeChat.preferences.visitType,
            postalCode: snapshot.profile.zip,
            timePreference: activeChat.preferences.preferredTimes,
            paymentPreference: snapshot.profile.payment,
            radiusMiles: 5,
          });
          if (result.saved) setSavedCareRequest(result.saved);
          return result;
        } finally {
          setSaving(false);
        }
      },
      importChatContext(id) {
        const source = chatSessions.find((session) => session.id === id);
        if (!source || source.id === activeChat.id) return;
        const item: ChatContextItem = {
          id: `conversation-${source.id}`,
          kind: "conversation",
          title: source.title,
          body: summarizeChat(source),
        };
        updateActiveChat((session) => session.context.some((context) => context.id === item.id)
          ? session
          : { ...session, context: [...session.context, item], updatedAt: new Date().toISOString() });
      },
      updateProfile(patch) {
        commit((current) => ({ ...current, profile: { ...current.profile, ...patch } }));
        if (patch.zip !== undefined || patch.payment !== undefined) {
          updateActiveChat((session) => ({
            ...session,
            preferences: {
              ...session.preferences,
              ...(patch.zip !== undefined ? { location: locationLabel(patch.zip) } : {}),
              ...(patch.payment !== undefined ? { paymentLabel: paymentLabel(patch.payment) } : {}),
            },
          }));
        }
      },
      updatePreferences: (patch) => updateActiveChat((session) => ({ ...session, preferences: { ...session.preferences, ...patch } })),
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
      async sendMessage(text) {
        const trimmed = text.trim();
        if (!trimmed || activeChat.pending) return;
        const time = clock();
        const turn = bookingTurn(trimmed, activeChat.bookingStep, activeChat.preferences, snapshot.profile);
        const stamp = Date.now();
        const sessionId = activeChat.id;
        const userMessage: ChatMessage = { id: `user-${stamp}`, role: "user", text: trimmed, time };
        const guidedBooking = activeChat.bookingStep !== "idle" || turn.step !== "idle";

        if (guidedBooking) {
          updateChat(sessionId, (session) => ({
            ...session,
            title: session.title === "New chat" ? chatTitleFromMessage(trimmed) : session.title,
            bookingStep: turn.step,
            preferences: turn.preferences,
            error: null,
            updatedAt: new Date().toISOString(),
            messages: [
              ...session.messages,
              userMessage,
              { id: `assistant-${stamp}`, role: "assistant", text: turn.reply, time },
            ],
          }));
          commit((current) => ({ ...current, profile: { ...current.profile, zip: turn.zip, payment: turn.payment } }));
          return;
        }

        const provider = activeChat.provider;
        const implicitAppointment = snapshot.appointment && trimmed.toLowerCase().includes("appointment context")
          ? appointmentContext(snapshot.appointment)
          : null;
        const requestContext = implicitAppointment && !activeChat.context.some((item) => item.id === implicitAppointment.id)
          ? [...activeChat.context, implicitAppointment]
          : activeChat.context;
        const history = activeChat.messages.slice(-12).map((message) => ({
          role: message.role,
          text: message.text.slice(0, 2_000),
        }));
        const context = requestContext.slice(0, 6).map((item) => ({
          kind: item.kind,
          title: item.title,
          body: item.body.slice(0, 2_000),
        }));

        updateChat(sessionId, (session) => ({
          ...session,
          title: session.title === "New chat" ? chatTitleFromMessage(trimmed) : session.title,
          pending: true,
          error: null,
          context: requestContext,
          updatedAt: new Date().toISOString(),
          messages: [...session.messages, userMessage],
        }));

        try {
          const response = await fetch(providerEndpoint(provider), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: trimmed, history, context }),
          });
          const payload = (await response.json()) as ChatApiResponse;
          if (!response.ok || !payload.text) {
            updateChat(sessionId, (session) => ({
              ...session,
              pending: false,
              error: describeChatError(response.status, payload, provider),
            }));
            return;
          }
          updateChat(sessionId, (session) => ({
            ...session,
            pending: false,
            error: null,
            updatedAt: new Date().toISOString(),
            messages: [...session.messages, {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              text: payload.text ?? "",
              time: clock(),
              provider,
              model: payload.model,
            }],
          }));
        } catch {
          updateChat(sessionId, (session) => ({
            ...session,
            pending: false,
            error: "The assistant could not be reached. Check your connection and try again.",
          }));
        }
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
  }, [activeChat, chatSessions, initialData, policyId, router, savedCareRequest, saving, snapshot, user]);

  return <CareContext.Provider value={value}>
    {initialData.mode === "fallback" ? <div className={styles.dataBanner} role="status"><span>{initialData.message}</span><button onClick={() => router.refresh()} type="button">Retry database</button></div> : null}
    {children}
  </CareContext.Provider>;
}

export function useCare() {
  const value = useContext(CareContext);
  if (!value) throw new Error("useCare must be used within CareProvider");
  return value;
}
