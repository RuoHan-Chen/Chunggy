"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { prepareReturnedTimeAction } from "@/app/care-actions";
import { IconBot, IconPaperclip, IconSend } from "@/components/careway/icons";
import { useCare } from "@/components/careway/provider";
import { displayPhone, workflowLabel } from "@/lib/careway/call-flow";
import { languageLocale, translate } from "@/lib/careway/i18n";
import { bookingChoices, isOpenAppointment } from "@/lib/careway/model";
import styles from "@/components/careway/careway.module.css";

function sameBookedTime(
  appointment: { id: string; locationId?: string; startIso: string; longDate: string; timeLabel: string },
  time: { optionId: string; label: string; startIso: string | null },
  locationId: string,
) {
  if (time.optionId && appointment.id === time.optionId) return true;
  if (time.startIso && appointment.startIso === time.startIso && (!appointment.locationId || appointment.locationId === locationId)) return true;
  const label = time.label.toLowerCase().replace(/[.,]/g, " ");
  const weekday = label.match(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/)?.[0];
  const clock = label.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (!weekday || !clock) return false;
  const minute = (clock[2] ?? "00").padStart(2, "0");
  const rendered = `${Number(clock[1])}:${minute} ${clock[3]}`;
  return appointment.longDate.toLowerCase().includes(weekday) && appointment.timeLabel.toLowerCase() === rendered;
}

const starterPrompts = [
  "Help me schedule a dental appointment",
  "Help me find an eye exam",
  "Explain an insurance term",
  "Review my past appointment context",
];

export function AssistantView() {
  const care = useCare();
  const t = (text: string) => translate(care.profile.language, text);
  const locale = languageLocale(care.profile.language);
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState("");
  const [searchError, setSearchError] = useState("");
  const [returnedTimeError, setReturnedTimeError] = useState("");
  const [preparingTime, setPreparingTime] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const transcriptRef = useRef<HTMLDivElement>(null);
  const choices = bookingChoices(care.bookingStep, care.profile.zip, care.profile.language);
  const offices = care.providerSlots.filter((slot, index, all) =>
    slot.visitType === care.preferences.visitType && all.findIndex((item) => item.provider === slot.provider) === index,
  );
  const reviewing = care.activeChat.callDraft?.workflow === "review";
  const callFailed = (care.activeChat.callDraft?.declineCount ?? 0) >= 2;
  const callResult = care.activeChat.callDraft?.result;
  const selectedOffice = offices.find((office) => office.locationId === care.activeChat.callDraft?.locationId);
  const appointmentHistory = care.appointments.length > 0 ? care.appointments : care.appointment ? [care.appointment] : [];
  const bookedAppointment = appointmentHistory.find((appointment) =>
    isOpenAppointment(appointment.status) && callResult?.availableTimes.some((time) => sameBookedTime(appointment, time, care.activeChat.callDraft.locationId)),
  );

  useEffect(() => {
    const node = transcriptRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [care.messages, care.bookingStep, care.activeChatId]);

  function submit(choice?: string) {
    const trimmed = (choice ?? draft).trim();
    const message = choice === undefined && attachment
      ? `${trimmed}${trimmed ? " " : ""}(file: ${attachment})`
      : trimmed;
    if (!message) return;
    void care.sendMessage(message);
    if (choice === undefined) {
      setDraft("");
      setAttachment("");
    }
  }

  function beginRename(id: string, title: string) {
    setRenamingId(id);
    setRenameDraft(title);
  }

  function chooseStarter(prompt: string) {
    if (prompt === "Review my past appointment context" && care.appointment) {
      care.importAppointmentContext();
    }
    submit(prompt);
  }

  function finishRename() {
    if (!renamingId) return;
    care.renameChat(renamingId, renameDraft);
    setRenamingId(null);
    setRenameDraft("");
  }

  function removeChat(id: string, title: string) {
    const warning = care.chatStorage === "account"
      ? `Delete “${title}”? It will be removed from your account.`
      : `Delete “${title}”? This chat cannot be recovered after you refresh.`;
    if (!window.confirm(warning)) return;
    care.deleteChat(id);
    if (renamingId === id) setRenamingId(null);
  }

  async function openReturnedTime(time: NonNullable<typeof callResult>["availableTimes"][number]) {
    if (!selectedOffice?.locationId || !care.savedCareRequest) return;
    setReturnedTimeError("");
    setPreparingTime(time.label);
    try {
      let option = time.optionId && time.startIso
        ? { optionId: time.optionId, startIso: time.startIso, endIso: time.endIso }
        : null;
      if (!option) {
        const prepared = await prepareReturnedTimeAction({
          conversationId: care.activeChatId,
          requestId: care.savedCareRequest.requestId,
          locationId: selectedOffice.locationId,
          label: time.label,
        });
        if (!prepared.ok) {
          setReturnedTimeError(prepared.message);
          return;
        }
        option = prepared.option;
      }
      const start = new Date(option.startIso);
      const end = option.endIso ? new Date(option.endIso) : new Date(start.getTime() + 45 * 60_000);
      care.selectSlot({
        ...selectedOffice,
        id: option.optionId,
        startIso: start.toISOString(),
        endIso: end.toISOString(),
        dateLabel: new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(start),
        longDate: new Intl.DateTimeFormat(locale, { weekday: "long", month: "long", day: "numeric", year: "numeric" }).format(start),
        timeLabel: new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(start),
        endLabel: new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(end),
        period: start.getHours() < 12 ? "morning" : "afternoon",
      });
      router.push("/appointments/review");
    } finally {
      setPreparingTime(null);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageIntro}>
        <h1>{t("Your care assistant")}</h1>
        <p>{t("Start separate conversations for scheduling and general information.")}</p>
      </header>
      <div className={styles.assistantGrid}>
        <aside className={styles.chatSidebar}>
          <div className={styles.chatSidebarHead}>
            <strong>{t("Conversations")}</strong>
            <button className={styles.newChatButton} onClick={care.createChat} type="button">{t("+ New chat")}</button>
          </div>
          <div className={styles.chatList}>
            {care.chatSessions.map((session) => {
              const active = session.id === care.activeChatId;
              return (
                <div className={active ? styles.chatListItemActive : styles.chatListItem} key={session.id}>
                  {renamingId === session.id ? (
                    <form
                      className={styles.chatRename}
                      onSubmit={(event) => {
                        event.preventDefault();
                        finishRename();
                      }}
                    >
                      <input
                        aria-label="Conversation name"
                        autoFocus
                        onChange={(event) => setRenameDraft(event.target.value)}
                        onBlur={finishRename}
                        value={renameDraft}
                      />
                    </form>
                  ) : (
                    <button className={styles.chatSessionButton} onClick={() => care.switchChat(session.id)} type="button">
                      <span>{session.title}</span>
                      <small>{(session.messagesLoaded ? session.messages.length : session.messageCount) === 0 ? t("No messages") : `${session.messagesLoaded ? session.messages.length : session.messageCount} ${t("messages")}`}</small>
                    </button>
                  )}
                  <div className={styles.chatSessionActions}>
                    <button onClick={() => beginRename(session.id, session.title)} type="button">{t("Rename")}</button>
                    <button onClick={() => removeChat(session.id, session.title)} type="button">{t("Delete")}</button>
                  </div>
                </div>
              );
            })}
          </div>
          {care.chatStorage === "session" ? (
            <p className={styles.temporaryNotice}>Chats stay in this session and reset when you refresh.</p>
          ) : null}
        </aside>

        <section className={styles.chatCard}>
          <div className={styles.chatTopbar}>
            <div>
              <strong>{care.activeChat.title}</strong>
              <small>
                {care.callingOffice
                  ? `Calling ${care.callingOffice}`
                  : care.bookingStep !== "idle"
                    ? `${workflowLabel(care.activeChat.callDraft?.workflow ?? "gathering")} · ${care.chatStorage === "account" && care.activeChat.stored ? "saved to your account" : "this session"}`
                    : care.chatStorage === "account"
                      ? care.activeChat.stored ? "Saved to your account" : "Saves with your next message"
                      : "This chat stays in this session"}
              </small>
            </div>
            <div className={styles.chatTools}>
              <div aria-label="AI provider" className={styles.providerToggle} role="group">
                <button
                  aria-pressed={care.activeChat.provider === "openai"}
                  className={care.activeChat.provider === "openai" ? styles.providerToggleActive : undefined}
                  disabled={care.activeChat.pending}
                  onClick={() => care.setChatProvider("openai")}
                  type="button"
                >
                  GPT
                </button>
                <button
                  aria-pressed={care.activeChat.provider === "oci"}
                  className={care.activeChat.provider === "oci" ? styles.providerToggleActive : undefined}
                  disabled={care.activeChat.pending}
                  onClick={() => care.setChatProvider("oci")}
                  type="button"
                >
                  OCI GenAI
                </button>
              </div>
            {care.appointment ? (
              <button className={styles.contextButton} onClick={care.importAppointmentContext} type="button">
                + Appointment context
              </button>
            ) : null}
            {care.savedCareRequest ? (
              <button className={styles.contextButton} onClick={care.importSavedRequest} type="button">
                {t("Import saved request")}
              </button>
            ) : null}
            </div>
          </div>

          {care.activeChat.context.length > 0 ? (
            <div className={styles.contextBar} aria-label="Imported context">
              {care.activeChat.context.map((item) => (
                <div className={styles.contextChip} key={item.id} title={item.body}>
                  <span>{item.kind === "appointment" ? "Appointment" : item.kind === "care_request" ? "Care request" : "Conversation"}</span>
                  <strong>{item.title}</strong>
                  <small>{item.body}</small>
                </div>
              ))}
            </div>
          ) : null}

          <div className={styles.transcript} ref={transcriptRef}>
            {care.messages.length === 0 ? (
              <div className={styles.chatEmpty}>
                <span className={styles.botAvatar}><IconBot /></span>
                <h2>{t("What can I help with?")}</h2>
                <p>{t("Choose a starting point or type your own question below.")}</p>
                <div className={styles.starterGrid}>
                  {starterPrompts.map((prompt) => (
                    <button className={styles.starterButton} key={prompt} onClick={() => chooseStarter(prompt)} type="button">
                      {t(prompt)}
                    </button>
                  ))}
                </div>
              </div>
            ) : care.messages.map((message) =>
              message.role === "user" ? (
                <div className={styles.userGroup} key={message.id}>
                  <p className={styles.userBubble}>{message.text}</p>
                  <time>{message.time}</time>
                </div>
              ) : (
                <div className={styles.botGroup} key={message.id}>
                  <span className={styles.botAvatar}><IconBot /></span>
                  <div>
                    <p className={styles.botBubble}>{message.text}</p>
                    <time>
                      {message.provider ? `${message.provider === "openai" ? "GPT" : "OCI GenAI"}${message.model ? ` · ${message.model}` : ""} · ` : ""}
                      {message.time}
                    </time>
                  </div>
                </div>
              ),
            )}
            {care.activeChat.pending ? (
              <div aria-live="polite" className={styles.botGroup}>
                <span className={styles.botAvatar}><IconBot /></span>
                <p className={styles.typingBubble}>{care.callingOffice ? `${t("Calling")} ${care.callingOffice}…` : `${t("Thinking")}…`}</p>
              </div>
            ) : null}
            {callResult && !callResult.savedForFollowUp && bookedAppointment ? (
              <div className={styles.returnedTimes}>
                <strong>{t("Appointment booked")}</strong>
                <span>{bookedAppointment.provider} · {bookedAppointment.longDate} · {bookedAppointment.timeLabel}</span>
                <Link
                  className={styles.returnedTime}
                  href="/appointments/confirmed"
                  onClick={() => care.focusAppointment(bookedAppointment.appointmentId ?? bookedAppointment.reference)}
                >
                  {t("View appointment")}
                </Link>
              </div>
            ) : null}
            {callResult && !callResult.savedForFollowUp && !bookedAppointment ? (
              <div className={styles.returnedTimes}>
                <strong>{t("Office response")}</strong>
                {callResult.availableTimes.length ? (
                  callResult.availableTimes.map((time, index) => (
                    <button
                      className={styles.returnedTime}
                      disabled={Boolean(preparingTime) || !selectedOffice?.locationId || !care.savedCareRequest}
                      key={`${time.label}-${index}`}
                      onClick={() => void openReturnedTime(time)}
                      type="button"
                    >
                      {preparingTime === time.label ? t("Preparing booking…") : time.label}
                    </button>
                  ))
                ) : (
                  <span>{t("No appointment times were returned.")}</span>
                )}
                {returnedTimeError ? <span className={styles.formError} role="alert">{returnedTimeError}</span> : null}
                <button className={styles.chip} onClick={() => submit("Save for follow-up")} type="button">
                  {t("Save for follow-up")}
                </button>
              </div>
            ) : null}
            {callResult?.savedForFollowUp ? (
              <p className={styles.followUpSaved}>Saved for follow-up. The office response will remain in this conversation.</p>
            ) : null}
            {choices.length > 0 ? (
              <div className={styles.chips}>
                {choices.map((choice) => (
                  <button className={styles.chip} disabled={care.activeChat.pending} key={choice} onClick={() => submit(choice)} type="button">{choice}</button>
                ))}
              </div>
            ) : null}
            {care.bookingStep === "ready" && !reviewing && !care.callingOffice && !callFailed && !callResult ? (
              <div className={styles.officeCards}>
                {offices.map((office) => (
                  <button
                    className={styles.officeCard}
                    disabled={care.activeChat.pending}
                    key={office.id}
                    onClick={() => submit(office.provider)}
                    type="button"
                  >
                    <strong>{office.provider}</strong>
                    <span>{office.address}, {office.cityLine}</span>
                    <span>{office.rating} {t("rating")} · {t("Estimated")} {office.estimate}</span>
                    <span>{displayPhone(office.phone ?? "")}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {reviewing && !care.callingOffice ? (
              <div className={styles.chips}>
                <button className={styles.btnPrimary} disabled={care.activeChat.pending} onClick={() => submit("Real Vapi call")} type="button">{t("Real Vapi call")}</button>
                <button className={styles.btnOutline} disabled={care.activeChat.pending} onClick={() => submit("Fake demo call")} type="button">{t("Fake demo call")}</button>
              </div>
            ) : null}
            {care.bookingStep === "ready" && !reviewing && !care.callingOffice && !callFailed && !callResult ? (
              <div className={styles.chips}>
                <button
                  className={styles.btnPrimary}
                  disabled={care.saving}
                  onClick={async () => {
                    setSearchError("");
                    const result = await care.prepareCareRequest();
                    if (!result.ok) {
                      setSearchError(result.message);
                      return;
                    }
                    router.push("/appointments/results");
                  }}
                  type="button"
                >
                  {care.saving ? t("Saving options…") : t("Find options")}
                </button>
                {searchError ? <p className={styles.formError}>{searchError}</p> : null}
              </div>
            ) : null}
          </div>
          {care.callingOffice ? (
            <div className={styles.callingBanner} role="status">
              <strong>{t("Calling")} {care.callingOffice}</strong>
              <span>{t("Please wait here. The result will appear in this chat when the call finishes.")}</span>
            </div>
          ) : null}
          {callFailed && !care.callingOffice ? (
            <div className={styles.callFailed} role="status">
              <strong>{t("Call failed")}</strong>
              <span>{t("No further call will be placed right now. Try again later.")}</span>
            </div>
          ) : null}
          {care.activeChat.error && !care.activeChat.pending ? (
            <div className={styles.chatError} role="alert">
              <strong>{t("Message not completed")}</strong>
              <span>{care.activeChat.error}</span>
              <button onClick={() => void care.retryMessage()} type="button">{t("Retry")}</button>
            </div>
          ) : null}
          <form
            className={styles.composer}
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <label className={styles.clip}>
              <IconPaperclip />
              <span className={styles.srOnly}>{t("Attach a file")}</span>
              <input
                disabled={care.activeChat.pending}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) setAttachment(file.name);
                }}
                type="file"
              />
            </label>
            <input
              disabled={care.activeChat.pending}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t("Ask a question or tell me what to book")}
              value={draft}
            />
            {attachment ? <em className={styles.fileChip}>{attachment}</em> : null}
            <button aria-label={t("Send")} className={styles.send} disabled={care.activeChat.pending || (!draft.trim() && !attachment)} type="submit"><IconSend /></button>
          </form>
        </section>
      </div>
    </div>
  );
}
