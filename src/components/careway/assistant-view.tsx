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
    care.sendMessage(message);
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
    if (!window.confirm(`Delete “${title}”? This temporary chat cannot be recovered.`)) return;
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
                      <small>{session.messages.length === 0 ? "No messages" : `${session.messages.length} messages`}</small>
                    </button>
                  )}
                  <div className={styles.chatSessionActions}>
                    {!active && session.messages.length > 0 ? (
                      <button onClick={() => care.importChatContext(session.id)} type="button">Add context</button>
                    ) : null}
                    <button onClick={() => beginRename(session.id, session.title)} type="button">Rename</button>
                    <button onClick={() => removeChat(session.id, session.title)} type="button">Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className={styles.temporaryNotice}>Chats are temporary in Phase 2 and reset when you refresh.</p>
        </aside>

        <section className={styles.chatCard}>
          <div className={styles.chatTopbar}>
            <div>
              <strong>{care.activeChat.title}</strong>
              <small>Not saved to Oracle yet</small>
            </div>
            {care.appointment ? (
              <button className={styles.contextButton} onClick={care.importAppointmentContext} type="button">
                + Appointment context
              </button>
            ) : null}
          </div>

          {care.activeChat.context.length > 0 ? (
            <div className={styles.contextBar} aria-label="Imported context">
              {care.activeChat.context.map((item) => (
                <div className={styles.contextChip} key={item.id} title={item.body}>
                  <span>{item.kind === "appointment" ? "Appointment" : "Conversation"}</span>
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
                    <time>{message.time}</time>
                  </div>
                </div>
              ),
            )}
            {choices.length > 0 ? (
              <div className={styles.chips}>
                {choices.map((choice) => (
                  <button className={styles.chip} key={choice} onClick={() => submit(choice)} type="button">{choice}</button>
                ))}
              </div>
            ) : null}
            {care.bookingStep === "ready" ? (
              <div className={styles.chips}>
                <button className={styles.btnPrimary} onClick={() => router.push("/appointments/results")} type="button">Find options</button>
              </div>
            ) : null}
          </div>
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
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) setAttachment(file.name);
                }}
                type="file"
              />
            </label>
            <input
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask a question or tell me what to book"
              value={draft}
            />
            {attachment ? <em className={styles.fileChip}>{attachment}</em> : null}
            <button aria-label="Send" className={styles.send} type="submit"><IconSend /></button>
          </form>
        </section>
      </div>
    </div>
  );
}
