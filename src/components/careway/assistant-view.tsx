"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { IconBot, IconPaperclip, IconSend } from "@/components/careway/icons";
import { useCare } from "@/components/careway/provider";
import { bookingChoices } from "@/lib/careway/model";
import styles from "@/components/careway/careway.module.css";

const starterPrompts = [
  "Help me schedule a dental appointment",
  "Help me find an eye exam",
  "Explain an insurance term",
  "Review my past appointment context",
];

export function AssistantView() {
  const care = useCare();
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState("");
  const [searchError, setSearchError] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const transcriptRef = useRef<HTMLDivElement>(null);
  const choices = bookingChoices(care.bookingStep, care.profile.zip);

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

  return (
    <div className={styles.page}>
      <header className={styles.pageIntro}>
        <h1>Your care assistant</h1>
        <p>Start separate conversations for scheduling and general information.</p>
      </header>
      <div className={styles.assistantGrid}>
        <aside className={styles.chatSidebar}>
          <div className={styles.chatSidebarHead}>
            <strong>Conversations</strong>
            <button className={styles.newChatButton} onClick={care.createChat} type="button">+ New chat</button>
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
                      <small>{(session.messagesLoaded ? session.messages.length : session.messageCount) === 0 ? "No messages" : `${session.messagesLoaded ? session.messages.length : session.messageCount} messages`}</small>
                    </button>
                  )}
                  <div className={styles.chatSessionActions}>
                    <button onClick={() => beginRename(session.id, session.title)} type="button">Rename</button>
                    <button onClick={() => removeChat(session.id, session.title)} type="button">Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className={styles.temporaryNotice}>
            {care.chatStorage === "account"
              ? "Conversations you start are saved to your account and stay available after you refresh."
              : "Chats stay in this session and reset when you refresh."}
          </p>
        </aside>

        <section className={styles.chatCard}>
          <div className={styles.chatTopbar}>
            <div>
              <strong>{care.activeChat.title}</strong>
              <small>
                {care.chatStorage === "account"
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
                Import saved request
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
                <h2>What can I help with?</h2>
                <p>Choose a starting point or type your own question below.</p>
                <div className={styles.starterGrid}>
                  {starterPrompts.map((prompt) => (
                    <button className={styles.starterButton} key={prompt} onClick={() => chooseStarter(prompt)} type="button">
                      {prompt}
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
                <p className={styles.typingBubble}>Thinking…</p>
              </div>
            ) : null}
            {choices.length > 0 ? (
              <div className={styles.chips}>
                {choices.map((choice) => (
                  <button className={styles.chip} disabled={care.activeChat.pending} key={choice} onClick={() => submit(choice)} type="button">{choice}</button>
                ))}
              </div>
            ) : null}
            {care.bookingStep === "ready" ? (
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
                  {care.saving ? "Saving options…" : "Find options"}
                </button>
                {searchError ? <p className={styles.formError}>{searchError}</p> : null}
              </div>
            ) : null}
          </div>
          {care.activeChat.error && !care.activeChat.pending ? (
            <div className={styles.chatError} role="alert">
              <strong>Message not completed</strong>
              <span>{care.activeChat.error}</span>
              <button onClick={() => void care.retryMessage()} type="button">Retry</button>
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
              <span className={styles.srOnly}>Attach a file</span>
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
              placeholder="Ask a question or tell me what to book"
              value={draft}
            />
            {attachment ? <em className={styles.fileChip}>{attachment}</em> : null}
            <button aria-label="Send" className={styles.send} disabled={care.activeChat.pending || (!draft.trim() && !attachment)} type="submit"><IconSend /></button>
          </form>
        </section>
      </div>
    </div>
  );
}
