"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { addConversationContextAction, cancelAppointmentAction, completeAssistantAction, deleteConversationAction, openConversationAction, placeOfficeCallAction, recordConversationAction, removeInsuranceAction, requestAppointmentAction, saveInsuranceAction, saveProfileAction, syncCareRequestAction } from "@/app/care-actions";
import { detectReason, emptyCallDraft, formatCallBrief, isCallConfirmation, isFakeCallConfirmation, isSideQuestion, resumeAfterSideQuestion } from "@/lib/careway/call-flow";
import styles from "@/components/careway/careway.module.css";
import {
  bookingTurn,
  chatFromSnapshot,
  chatTitleFromMessage,
  clock,
  emptyChatSession,
  locationLabel,
  paymentLabel,
  visitTypeLabel,
  type Appointment,
  type CareBootstrap,
  isOpenAppointment,
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
  notices: Notice[]; providerSlots: Slot[]; savedCareRequest: SavedCareRequest | null; appointments: Appointment[]; retryDatabase: () => void;
  chatSessions: ChatSession[]; activeChatId: string; activeChat: ChatSession; chatStorage: "account" | "session";
  createChat: () => void; switchChat: (id: string) => void;
  renameChat: (id: string, title: string) => void; deleteChat: (id: string) => void; retryMessage: () => Promise<void>;
  setChatProvider: (provider: ChatProvider) => void;
  importAppointmentContext: () => void; importChatContext: (id: string) => void;
  importSavedRequest: () => void; prepareCareRequest: () => Promise<CareSaveResult>;
  updateProfile: (patch: Partial<Profile>) => void; updatePreferences: (patch: Partial<Preferences>) => void;
  setLanguage: (language: string) => Promise<CareSaveResult>;
  deferOnboarding: () => Promise<CareSaveResult>; completeOnboarding: () => Promise<CareSaveResult>;
  saveProfile: () => Promise<CareSaveResult>; saveInsurance: () => Promise<CareSaveResult>;
  sendMessage: (text: string) => Promise<void>; callingOffice: string | null; selectSlot: (slot: Slot) => void;
  requestAppointment: (shareSms: boolean, callMode: "real" | "fake") => Promise<CareSaveResult>; cancelAppointment: () => Promise<CareSaveResult>;
  focusAppointment: (key: string) => void;
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
    title: `${visitTypeLabel(appointment.visitType)} appointment`,
    body: `${appointment.provider} · ${appointment.longDate} at ${appointment.timeLabel} · ${appointment.status}${appointment.simulated ? " · simulated, office not contacted" : ""}`,
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
  const [appointments, setAppointments] = useState(initialData.appointments);
  const [saving, setSaving] = useState(false);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => initialData.conversations.length > 0 ? initialData.conversations : [chatFromSnapshot(initialData.snapshot)]);
  const [activeChatId, setActiveChatId] = useState(initialData.conversations[0]?.id ?? "chat-initial");
  const [callingOffice, setCallingOffice] = useState<string | null>(null);
  const storedIds = useRef(new Map<string, string>());
  const chatSaves = useRef(new Map<string, Promise<ChatSession>>());
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
    const persistChats = initialData.mode === "database" && preview == null;
    const sessionOnly = (message: string): CareSaveResult => ({ ok: true, persisted: false, message: `${message} Saved for this session only because Oracle is disconnected.` });
    type OutgoingMessage = {
      role: "user" | "assistant";
      text: string;
      provider?: ChatProvider | null;
      model?: string | null;
      status?: "complete" | "failed";
      error?: string | null;
    };
    function outgoingMessage(message: ChatMessage): OutgoingMessage {
      return {
        role: message.role,
        text: message.text,
        provider: message.provider ?? null,
        model: message.model ?? null,
        status: message.status === "failed" ? "failed" : "complete",
        error: message.error ?? null,
      };
    }
    function installChat(localId: string, session: ChatSession) {
      storedIds.current.set(localId, session.id);
      storedIds.current.set(session.id, session.id);
      setChatSessions((current) => {
        const seen = new Set<string>();
        return current
          .map((item) => item.id === localId || item.id === session.id ? session : item)
          .filter((item) => {
            if (seen.has(item.id)) return false;
            seen.add(item.id);
            return true;
          });
      });
      setActiveChatId((current) => current === localId ? session.id : current);
    }
    function persistChat(session: ChatSession, newMessages: OutgoingMessage[]) {
      if (!persistChats) return Promise.resolve(session);
      const run = async () => {
        const knownId = session.stored ? session.id : storedIds.current.get(session.id) ?? null;
        const result = await recordConversationAction({
          conversationId: knownId,
          title: session.title,
          provider: session.provider,
          bookingStep: session.bookingStep,
          preferences: session.preferences,
          messages: knownId ? newMessages : [...session.messages.map(outgoingMessage), ...newMessages],
          context: knownId ? [] : session.context,
          draftJson: JSON.stringify(session.callDraft ?? emptyCallDraft()),
        });
        if (!result.ok || !result.session) throw new Error(result.message);
        storedIds.current.set(session.id, result.session.id);
        storedIds.current.set(result.session.id, result.session.id);
        return result.session;
      };
      const previous = chatSaves.current.get(session.id) ?? Promise.resolve(session);
      const next = previous.then(run, run);
      chatSaves.current.set(session.id, next);
      void next.finally(() => {
        if (chatSaves.current.get(session.id) === next) chatSaves.current.delete(session.id);
      });
      return next;
    }
    async function ensureLoaded(session: ChatSession) {
      if (!persistChats || !session.stored || session.messagesLoaded) return session;
      const opened = await openConversationAction(session.id);
      if (!opened.session) return session;
      installChat(session.id, opened.session);
      return opened.session;
    }
    function rememberContext(item: ChatContextItem) {
      const session = activeChat.context.some((context) => context.id === item.id)
        ? activeChat
        : { ...activeChat, context: [...activeChat.context, item], updatedAt: new Date().toISOString() };
      if (session !== activeChat) updateActiveChat(() => session);
      if (!persistChats || activeChat.context.some((context) => context.id === item.id)) return;
      void (async () => {
        try {
          const saved = await persistChat(session, []);
          if (saved.context.some((context) => context.id === item.id)) {
            installChat(session.id, { ...saved, pending: session.pending });
            return;
          }
          const added = await addConversationContextAction(saved.id, item);
          if (added.session) installChat(session.id, { ...added.session, pending: session.pending });
        } catch (error) {
          updateChat(session.id, (current) => ({ ...current, error: error instanceof Error ? error.message : "Context could not be saved." }));
        }
      })();
    }
    async function askModel(session: ChatSession, message: string, history: ChatMessage[], requestContext: ChatContextItem[], replaceMessageId: string | null) {
      const provider = session.provider;
      const response = await fetch(providerEndpoint(provider), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          language: snapshot.profile.language,
          history: history.slice(-12).map((item) => ({ role: item.role, text: item.text.slice(0, 2_000) })),
          context: requestContext.slice(0, 6).map((item) => ({ kind: item.kind, title: item.title, body: item.body.slice(0, 2_000) })),
        }),
      });
      const payload = (await response.json()) as ChatApiResponse;
      const failed = !response.ok || !payload.text;
      const text = failed ? describeChatError(response.status, payload, provider) : payload.text ?? "";
      const outgoing: OutgoingMessage = {
        role: "assistant",
        text,
        provider,
        model: failed ? null : payload.model ?? null,
        status: failed ? "failed" : "complete",
        error: failed ? text : null,
      };
      if (!persistChats) {
        updateChat(session.id, (current) => ({
          ...current,
          pending: false,
          error: failed ? text : null,
          updatedAt: new Date().toISOString(),
          messages: replaceMessageId
            ? current.messages.map((item) => item.id === replaceMessageId ? { ...item, text, time: clock(), provider, model: payload.model, status: outgoing.status, error: outgoing.error } : item)
            : [...current.messages, { id: `assistant-${Date.now()}`, role: "assistant", text, time: clock(), provider, model: payload.model, status: outgoing.status, error: outgoing.error }],
        }));
        return;
      }
      const saved = await completeAssistantAction({
        conversationId: storedIds.current.get(session.id) ?? session.id,
        replaceMessageId,
        message: outgoing,
      });
      if (!saved.session) throw new Error(saved.message);
      installChat(session.id, { ...saved.session, pending: false });
    }
    async function persistProfile(status: "NOT_STARTED" | "DEFERRED" | "COMPLETE") {
      if (initialData.mode === "fallback") return sessionOnly("Profile updated.");
      setSaving(true);
      try { return await saveProfileAction(snapshot.profile, status); } finally { setSaving(false); }
    }

    return {
      ready: true, user, dataMode: initialData.mode, dataMessage: initialData.message, saving,
      profile: snapshot.profile, preferences: activeChat.preferences, messages: activeChat.messages,
      bookingStep: activeChat.bookingStep, draft: snapshot.draft,
      appointment: snapshot.appointment,       notices: snapshot.notices, providerSlots: initialData.providerSlots,
      savedCareRequest, appointments,
      chatSessions, activeChatId: activeChat.id, activeChat, chatStorage: persistChats ? "account" : "session", callingOffice,
      retryDatabase: () => router.refresh(),
      createChat() {
        const session = emptyChatSession(snapshot.profile, nextChatId());
        if (!persistChats) {
          setChatSessions((current) => [session, ...current]);
          setActiveChatId(session.id);
          return;
        }
        void (async () => {
          const kept: ChatSession[] = [];
          for (const existing of chatSessions) {
            if (existing.stored || storedIds.current.has(existing.id)) {
              kept.push(existing);
              continue;
            }
            try {
              const saved = await persistChat(existing, []);
              installChat(existing.id, saved);
              kept.push(saved);
            } catch (error) {
              kept.push({ ...existing, error: error instanceof Error ? error.message : "This chat could not be saved." });
            }
          }
          try {
            const saved = await persistChat(session, []);
            setChatSessions([saved, ...kept.filter((item) => item.id !== saved.id)]);
            setActiveChatId(saved.id);
          } catch (error) {
            const failed = { ...session, error: error instanceof Error ? error.message : "This chat could not be saved." };
            setChatSessions([failed, ...kept]);
            setActiveChatId(failed.id);
          }
        })();
      },
      switchChat(id) {
        setActiveChatId(id);
        const session = chatSessions.find((item) => item.id === id);
        if (!session || session.messagesLoaded || !session.stored || !persistChats) return;
        void openConversationAction(id).then((result) => {
          if (result.session) installChat(id, result.session);
        });
      },
      setChatProvider(provider) {
        if (activeChat.pending) return;
        const next = { ...activeChat, provider, error: null };
        updateActiveChat(() => next);
        if (!persistChats) return;
        void persistChat(next, [])
          .then((saved) => installChat(activeChat.id, { ...saved, pending: false, error: null }))
          .catch((error: unknown) => updateChat(activeChat.id, (current) => ({ ...current, error: error instanceof Error ? error.message : "The provider could not be saved." })));
      },
      renameChat(id, title) {
        const trimmed = title.trim();
        if (!trimmed) return;
        const session = chatSessions.find((item) => item.id === id);
        if (!session) return;
        const next = { ...session, title: trimmed, updatedAt: new Date().toISOString() };
        setChatSessions((current) => current.map((item) => item.id === id ? next : item));
        if (!persistChats) return;
        void persistChat(next, [])
          .then((saved) => installChat(id, { ...saved, pending: session.pending }))
          .catch((error: unknown) => updateChat(id, (current) => ({ ...current, error: error instanceof Error ? error.message : "The name could not be saved." })));
      },
      deleteChat(id) {
        void (async () => {
          const session = chatSessions.find((item) => item.id === id);
          const serverId = session?.stored ? session.id : storedIds.current.get(id);
          if (persistChats && serverId) {
            const result = await deleteConversationAction(serverId);
            if (!result.ok) {
              updateChat(id, (current) => ({ ...current, error: result.message }));
              return;
            }
          }
          const remaining = chatSessions.filter((item) => item.id !== id && item.id !== serverId);
          if (remaining.length === 0) {
            const replacement = emptyChatSession(snapshot.profile, nextChatId());
            setChatSessions([replacement]);
            setActiveChatId(replacement.id);
            return;
          }
          setChatSessions(remaining);
          if (activeChat.id === id || activeChat.id === serverId) setActiveChatId(remaining[0].id);
        })();
      },
      importAppointmentContext() {
        const appointment = appointments.find((item) => isOpenAppointment(item.status)) ?? snapshot.appointment;
        if (!appointment) return;
        rememberContext(appointmentContext(appointment));
      },
      importSavedRequest() {
        if (!savedCareRequest) return;
        const optionSummary = savedCareRequest.options
          .map((option) => `${option.provider} ${option.dateLabel} ${option.timeLabel}`)
          .join("; ");
        const item: ChatContextItem = {
          id: `care-request-${savedCareRequest.requestId}`,
          kind: "care_request",
          title: `${visitTypeLabel(savedCareRequest.visitType)} request`,
          body: [
            savedCareRequest.postalCode ? `Near ${savedCareRequest.postalCode} within ${savedCareRequest.radiusMiles} miles` : "Location not set",
            savedCareRequest.timePreference,
            savedCareRequest.paymentPreference,
            optionSummary ? `Options: ${optionSummary}` : "No matching options",
          ].filter(Boolean).join(" · "),
        };
        rememberContext(item);
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
        rememberContext(item);
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
      async setLanguage(language) {
        const profile = { ...snapshot.profile, language };
        commit((current) => ({ ...current, profile: { ...current.profile, language } }));
        if (initialData.mode === "fallback") return sessionOnly("Language changed for this session.");
        return saveProfileAction(
          profile,
          profile.onboardingComplete ? "COMPLETE" : profile.deferred ? "DEFERRED" : "NOT_STARTED",
        );
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
        const session = await ensureLoaded(activeChat);
        const time = clock();
        const draft = session.callDraft ?? emptyCallDraft();
        const offices = initialData.providerSlots.filter((slot) => slot.visitType === session.preferences.visitType);
        const chosenOffice = offices.find((slot) => slot.provider.toLowerCase() === trimmed.toLowerCase());
        const confirming = isCallConfirmation(trimmed) && draft.workflow === "review" && Boolean(draft.officeName);
        const simulateCall = isFakeCallConfirmation(trimmed);
        const sideQuestion = session.bookingStep !== "idle" && isSideQuestion(trimmed) && !chosenOffice && !confirming;
        const savingFollowUp = trimmed.toLowerCase() === "save for follow-up" && Boolean(draft.result);
        const stamp = Date.now();
        const sessionId = session.id;
        const userMessage: ChatMessage = { id: `user-${stamp}`, role: "user", text: trimmed, time };
        const nextTitle = session.title === "New chat" ? chatTitleFromMessage(trimmed) : session.title;

        if (savingFollowUp && draft.result) {
          const reply = "Saved for follow-up. The office response and available times will remain in this conversation.";
          const nextDraft = { ...draft, result: { ...draft.result, savedForFollowUp: true } };
          const next = { ...session, title: nextTitle, callDraft: nextDraft, error: null };
          updateChat(sessionId, (current) => ({
            ...next,
            messages: [...current.messages, userMessage, { id: `assistant-${stamp}`, role: "assistant", text: reply, time, status: "complete" }],
          }));
          if (!persistChats) return;
          try {
            const saved = await persistChat(next, [
              { role: "user", text: trimmed, status: "complete" },
              { role: "assistant", text: reply, status: "complete" },
            ]);
            installChat(sessionId, { ...saved, pending: false, error: null });
          } catch (error) {
            updateChat(sessionId, (current) => ({ ...current, error: error instanceof Error ? error.message : "The follow-up request could not be saved." }));
          }
          return;
        }

        if (sideQuestion) {
          const resume = resumeAfterSideQuestion(session.bookingStep, session.preferences, draft);
          updateChat(sessionId, (current) => ({
            ...current,
            title: nextTitle,
            pending: true,
            error: null,
            messages: [...current.messages, userMessage],
          }));
          try {
            const response = await fetch(providerEndpoint(session.provider), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: trimmed,
                language: snapshot.profile.language,
                history: session.messages.filter((message) => message.status !== "failed").slice(-12).map((message) => ({
                  role: message.role,
                  text: message.text.slice(0, 2_000),
                })),
                context: [],
              }),
            });
            const payload = (await response.json()) as ChatApiResponse;
            const answer = response.ok && payload.text ? payload.text : describeChatError(response.status, payload, session.provider);
            const reply = `${answer}\n\n${resume}`;
            const next = { ...session, title: nextTitle, callDraft: draft, pending: false, error: null };
            updateChat(sessionId, (current) => ({
              ...next,
              messages: [...current.messages, { id: `assistant-${Date.now()}`, role: "assistant", text: reply, time: clock(), provider: session.provider, model: payload.model, status: "complete" }],
            }));
            if (persistChats) {
              const saved = await persistChat(next, [
                { role: "user", text: trimmed, status: "complete" },
                { role: "assistant", text: reply, provider: session.provider, model: payload.model ?? null, status: "complete" },
              ]);
              installChat(sessionId, { ...saved, pending: false, error: null });
            }
          } catch {
            updateChat(sessionId, (current) => ({ ...current, pending: false, error: "The assistant could not be reached. Check your connection and try again." }));
          }
          return;
        }

        if (chosenOffice && session.bookingStep === "ready" && draft.declineCount >= 2) {
          const reply = `Call failed. ${draft.officeName || chosenOffice.provider} declined the call twice, so no further call will be placed right now. Try again later.`;
          const next = { ...session, title: nextTitle, callDraft: { ...draft, workflow: "failed" as const, resultText: reply }, error: null };
          updateChat(sessionId, (current) => ({
            ...next,
            messages: [...current.messages, userMessage, { id: `assistant-${stamp}`, role: "assistant", text: reply, time, status: "complete" }],
          }));
          if (!persistChats) return;
          try {
            const saved = await persistChat(next, [
              { role: "user", text: trimmed, status: "complete" },
              { role: "assistant", text: reply, status: "complete" },
            ]);
            installChat(sessionId, { ...saved, pending: false, error: null });
          } catch (error) {
            updateChat(sessionId, (current) => ({ ...current, error: error instanceof Error ? error.message : "The call result could not be saved." }));
          }
          return;
        }

        if (chosenOffice && session.bookingStep === "ready") {
          const nextDraft = {
            ...draft,
            workflow: "review" as const,
            reason: draft.reason || detectReason(`${session.messages.map((message) => message.text).join(" ")} ${trimmed}`),
            officeName: chosenOffice.provider,
            officePhone: chosenOffice.phone ?? "",
            locationId: chosenOffice.locationId ?? "",
          };
          const reply = formatCallBrief(snapshot.profile, session.preferences, nextDraft);
          const next = { ...session, title: nextTitle, bookingStep: "ready" as const, callDraft: nextDraft, error: null };
          updateChat(sessionId, (current) => ({
            ...next,
            messages: [...current.messages, userMessage, { id: `assistant-${stamp}`, role: "assistant", text: reply, time, status: "complete" }],
          }));
          if (!persistChats) return;
          try {
            const saved = await persistChat(next, [
              { role: "user", text: trimmed, status: "complete" },
              { role: "assistant", text: reply, status: "complete" },
            ]);
            installChat(sessionId, { ...saved, pending: false, error: null });
          } catch (error) {
            updateChat(sessionId, (current) => ({ ...current, error: error instanceof Error ? error.message : "The call brief could not be saved." }));
          }
          return;
        }

        if (confirming) {
          setCallingOffice(draft.officeName);
          const callingDraft = { ...draft, workflow: "calling" as const };
          updateChat(sessionId, (current) => ({
            ...current,
            pending: true,
            error: null,
            callDraft: callingDraft,
            messages: [...current.messages, userMessage],
          }));
          let conversationId = session.stored ? session.id : storedIds.current.get(session.id) ?? null;
          if (persistChats) {
            try {
              const saved = await persistChat({ ...session, title: nextTitle, callDraft: callingDraft }, [
                { role: "user", text: trimmed, status: "complete" },
              ]);
              conversationId = saved.id;
              installChat(sessionId, { ...saved, pending: true, callDraft: callingDraft });
            } catch (error) {
              setCallingOffice(null);
              updateChat(sessionId, (current) => ({
                ...current,
                pending: false,
                error: error instanceof Error ? error.message : "The confirmation could not be saved.",
              }));
              return;
            }
          }
          try {
            const result = await placeOfficeCallAction({
              conversationId,
              visitType: session.preferences.visitType,
              postalCode: snapshot.profile.zip,
              timePreference: session.preferences.preferredTimes,
              paymentPreference: snapshot.profile.payment,
              locationId: draft.locationId,
              reason: draft.reason,
              declineCount: draft.declineCount,
              simulate: simulateCall,
            });
            if (result.saved) setSavedCareRequest(result.saved);
            const finished = { ...session, title: nextTitle, callDraft: result.callDraft, pending: false, error: null };
            if (persistChats && conversationId) {
              const saved = await persistChat({ ...finished, id: conversationId, stored: true }, [
                { role: "assistant", text: result.reply, status: "complete", error: null },
              ]);
              installChat(conversationId, { ...saved, pending: false, error: null, callDraft: result.callDraft });
            } else {
              updateChat(sessionId, (current) => ({
                ...finished,
                messages: [...current.messages, { id: `assistant-${Date.now()}`, role: "assistant", text: result.reply, time: clock(), status: "complete", error: null }],
              }));
            }
          } finally {
            setCallingOffice(null);
          }
          return;
        }

        const turn = bookingTurn(trimmed, session.bookingStep, session.preferences, snapshot.profile);
        const guidedBooking = session.bookingStep !== "idle" || turn.step !== "idle";

        if (guidedBooking) {
          const next = {
            ...session,
            title: nextTitle,
            bookingStep: turn.step,
            preferences: turn.preferences,
            callDraft: { ...draft, reason: draft.reason || detectReason(trimmed) },
            error: null,
            updatedAt: new Date().toISOString(),
          };
          updateChat(sessionId, (current) => ({
            ...next,
            messages: [
              ...current.messages,
              userMessage,
              { id: `assistant-${stamp}`, role: "assistant", text: turn.reply, time, status: "complete" },
            ],
          }));
          const nextProfile = { ...snapshot.profile, zip: turn.zip, payment: turn.payment };
          const profileChanged = nextProfile.zip !== snapshot.profile.zip || nextProfile.payment !== snapshot.profile.payment;
          commit((current) => ({ ...current, profile: { ...current.profile, zip: turn.zip, payment: turn.payment } }));
          if (!persistChats) return;
          try {
            const profileResult = profileChanged
              ? await saveProfileAction(
                  nextProfile,
                  nextProfile.onboardingComplete ? "COMPLETE" : nextProfile.deferred ? "DEFERRED" : "NOT_STARTED",
                )
              : null;
            const saved = await persistChat(next, [
              { role: "user", text: trimmed, status: "complete" },
              { role: "assistant", text: turn.reply, status: "complete" },
            ]);
            installChat(sessionId, {
              ...saved,
              pending: false,
              error: profileResult && !profileResult.ok ? profileResult.message : null,
            });
          } catch (error) {
            updateChat(sessionId, (current) => ({
              ...current,
              title: session.title,
              bookingStep: session.bookingStep,
              preferences: session.preferences,
              messages: session.messages,
              error: error instanceof Error ? error.message : "This conversation could not be saved.",
            }));
          }
          return;
        }

        const implicitAppointment = snapshot.appointment && trimmed.toLowerCase().includes("appointment context")
          ? appointmentContext(snapshot.appointment)
          : null;
        const requestContext = implicitAppointment && !session.context.some((item) => item.id === implicitAppointment.id)
          ? [...session.context, implicitAppointment]
          : session.context;
        const history = session.messages.filter((message) => message.status !== "failed");
        updateChat(sessionId, (current) => ({
          ...current,
          title: nextTitle,
          pending: true,
          error: null,
          context: requestContext,
          updatedAt: new Date().toISOString(),
          messages: [...current.messages, userMessage],
        }));
        let conversation = { ...session, title: nextTitle, context: requestContext };
        if (persistChats) {
          try {
            const saved = await persistChat(conversation, [{ role: "user", text: trimmed, status: "complete" }]);
            conversation = { ...saved, pending: true, error: null, context: requestContext };
            installChat(sessionId, conversation);
          } catch (error) {
            updateChat(sessionId, (current) => ({
              ...current,
              title: session.title,
              messages: session.messages,
              pending: false,
              error: error instanceof Error ? error.message : "This message could not be saved.",
            }));
            return;
          }
        }
        try {
          await askModel(conversation, trimmed, history, requestContext, null);
        } catch {
          updateChat(conversation.id, (current) => ({
            ...current,
            pending: false,
            error: "The assistant could not be reached. Check your connection and try again.",
          }));
        }
      },
      async retryMessage() {
        if (activeChat.pending) return;
        const session = await ensureLoaded(activeChat);
        const failed = session.messages.at(-1)?.status === "failed" ? session.messages.at(-1) ?? null : null;
        const userMessage = [...session.messages].reverse().find((message) => message.role === "user");
        if (!userMessage) return;
        const history = session.messages.filter((message) => message.id !== userMessage.id && message.id !== failed?.id && message.status !== "failed");
        updateChat(session.id, (current) => ({ ...current, pending: true, error: null }));
        try {
          await askModel(session, userMessage.text, history, session.context, failed?.id ?? null);
        } catch {
          updateChat(session.id, (current) => ({
            ...current,
            pending: false,
            error: "The assistant could not be reached. Check your connection and try again.",
          }));
        }
      },
      selectSlot: (slot) => commit((current) => ({ ...current, draft: slot })),
      focusAppointment(key) {
        const appointment = appointments.find((item) => item.appointmentId === key || item.reference === key);
        if (!appointment) return;
        commit((current) => ({ ...current, appointment }));
      },
      async requestAppointment(shareSms, callMode) {
        if (!snapshot.draft) return { ok: false, persisted: false, message: "Choose a time first." };
        const remember = (appointment: Appointment) => {
          commit((current) => ({
            ...current,
            appointment,
            notices: [{
              id: `booked-${appointment.reference}`,
              title: appointment.simulated ? "Simulated request saved" : "Appointment time requested",
              body: appointment.simulated
                ? `${appointment.provider} · ${appointment.longDate} at ${appointment.timeLabel}. Reference ${appointment.reference}. The office was not contacted.`
                : `${appointment.provider} · ${appointment.longDate} at ${appointment.timeLabel}. Reference ${appointment.reference}. Waiting for office confirmation.`,
              read: false,
            }, ...current.notices],
          }));
          setAppointments((current) => [appointment, ...current.filter((item) => item.appointmentId !== appointment.appointmentId || appointment.appointmentId === null)]);
          setSavedCareRequest((current) => current ? { ...current, options: current.options.filter((option) => option.id !== snapshot.draft?.id) } : current);
        };
        if (initialData.mode === "fallback") {
          if (callMode === "real") return sessionOnly("Real booking calls require the database connection.");
          const appointment: Appointment = { ...snapshot.draft, appointmentId: null, status: "simulated", simulated: true };
          remember(appointment);
          return sessionOnly("Fake booking call kept in this session. The office was not contacted.");
        }
        setSaving(true);
        try {
          const result = await requestAppointmentAction({ optionId: snapshot.draft.id, shareSms, callMode });
          if (result.appointment) remember(result.appointment);
          return result;
        } finally {
          setSaving(false);
        }
      },
      async cancelAppointment() {
        const currentAppointment = snapshot.appointment && isOpenAppointment(snapshot.appointment.status)
          ? snapshot.appointment
          : appointments.find((item) => isOpenAppointment(item.status)) ?? null;
        if (!currentAppointment) return { ok: false, persisted: false, message: "No appointment to cancel." };
        const remember = (appointment: Appointment) => {
          commit((current) => ({
            ...current,
            appointment,
            notices: [{ id: `cancel-${Date.now()}`, title: "Appointment request cancelled", body: `${appointment.provider} is no longer on your schedule. The office was not contacted.`, read: false }, ...current.notices],
          }));
          setAppointments((current) => current.map((item) => item.appointmentId === appointment.appointmentId && item.reference === appointment.reference ? appointment : item));
        };
        if (!currentAppointment.appointmentId || initialData.mode === "fallback") {
          remember({ ...currentAppointment, status: "cancelled" });
          return sessionOnly("Cancellation kept in this session. The office was not contacted.");
        }
        setSaving(true);
        try {
          const result = await cancelAppointmentAction(currentAppointment.appointmentId);
          if (result.appointment) remember(result.appointment);
          return result;
        } finally {
          setSaving(false);
        }
      },
      markNoticesRead: () => commit((current) => ({ ...current, notices: current.notices.map((notice) => ({ ...notice, read: true })) })),
      requestCoverage: () => commit((current) => ({ ...current, profile: { ...current.profile, coverageStatus: "requested" } })),
      async clearInsurance() {
        const result = initialData.mode === "fallback" ? sessionOnly("Insurance removed.") : await removeInsuranceAction();
        if (result.ok) { setPolicyId(null); commit((current) => ({ ...current, profile: { ...current.profile, insuranceCompany: "", memberId: "", planName: "", cardFrontName: "", cardBackName: "", coverageStatus: "not_verified" } })); }
        return result;
      },
    };
  }, [activeChat, appointments, callingOffice, chatSessions, initialData, policyId, preview, router, savedCareRequest, saving, snapshot, user]);

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
