"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { IconBot, IconPaperclip, IconSend } from "@/components/careway/icons";
import { useCare } from "@/components/careway/provider";
import { bookingChoices } from "@/lib/careway/model";
import styles from "@/components/careway/careway.module.css";

export function AssistantView() {
  const care = useCare();
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState("");
  const transcriptRef = useRef<HTMLDivElement>(null);
  const choices = bookingChoices(care.bookingStep, care.profile.zip);

  useEffect(() => {
    const node = transcriptRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [care.messages, care.bookingStep]);

  function submit(choice?: string) {
    const trimmed = (choice ?? draft).trim();
    const message =
      choice === undefined && attachment
        ? `${trimmed}${trimmed ? " " : ""}(file: ${attachment})`
        : trimmed;
    if (!message) return;
    care.sendMessage(message);
    if (choice === undefined) {
      setDraft("");
      setAttachment("");
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.pageIntro}>
        <h1>Your care assistant</h1>
        <p>Helps with scheduling and general information.</p>
      </header>
      <div className={styles.assistantGrid}>
        <section className={styles.chatCard}>
          <div className={styles.transcript} ref={transcriptRef}>
            {care.messages.map((message) =>
              message.role === "user" ? (
                <div className={styles.userGroup} key={message.id}>
                  <p className={styles.userBubble}>{message.text}</p>
                  <time>{message.time}</time>
                </div>
              ) : (
                <div className={styles.botGroup} key={message.id}>
                  <span className={styles.botAvatar}>
                    <IconBot />
                  </span>
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
                  <button className={styles.chip} key={choice} onClick={() => submit(choice)} type="button">
                    {choice}
                  </button>
                ))}
              </div>
            ) : null}
            {care.bookingStep === "ready" ? (
              <div className={styles.chips}>
                <button className={styles.btnPrimary} onClick={() => router.push("/appointments/results")} type="button">
                  Find options
                </button>
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
            <button aria-label="Send" className={styles.send} type="submit">
              <IconSend />
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
