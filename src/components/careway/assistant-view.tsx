"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  IconBot,
  IconCalendar,
  IconCard,
  IconPaperclip,
  IconPin,
  IconSend,
  IconTooth,
} from "@/components/careway/icons";
import { useCare } from "@/components/careway/provider";
import { timeChoices, visitTypes } from "@/lib/careway/model";
import styles from "@/components/careway/careway.module.css";

export function AssistantView() {
  const care = useCare();
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = transcriptRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [care.messages]);

  function submit() {
    const text = attachment ? `${draft.trim()}${draft.trim() ? " " : ""}(file: ${attachment})` : draft;
    care.sendMessage(text);
    setDraft("");
    setAttachment("");
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
            <div className={styles.chips}>
              {timeChoices.map((choice) => (
                <button
                  className={
                    care.preferences.preferredTimes === choice
                      ? styles.chipSelected
                      : styles.chip
                  }
                  key={choice}
                  onClick={() => care.chooseTime(choice)}
                  type="button"
                >
                  {choice}
                </button>
              ))}
            </div>
          </div>
          <form
            className={styles.composer}
            onSubmit={(event) => {
              event.preventDefault();
              if (!draft.trim() && !attachment) return;
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
              placeholder="Ask a question or add a preference"
              value={draft}
            />
            {attachment ? <em className={styles.fileChip}>{attachment}</em> : null}
            <button aria-label="Send" className={styles.send} type="submit">
              <IconSend />
            </button>
          </form>
        </section>

        <div className={styles.stack}>
          <section className={styles.card}>
            <h2>Booking preferences</h2>
            <p className={styles.cardLede}>Tell us what you’re looking for.</p>
            <PrefRow
              editing={editing === "visit"}
              icon={<IconTooth />}
              label="Visit type"
              onEdit={() => setEditing(editing === "visit" ? null : "visit")}
              value={care.preferences.visitType}
            >
              <select
                className={styles.input}
                onChange={(event) => {
                  care.updatePreferences({ visitType: event.target.value });
                  setEditing(null);
                }}
                value={care.preferences.visitType}
              >
                {visitTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </PrefRow>
            <PrefRow
              editing={editing === "location"}
              icon={<IconPin />}
              label="Location"
              onEdit={() => setEditing(editing === "location" ? null : "location")}
              value={care.preferences.location}
            >
              <input
                className={styles.input}
                onChange={(event) => {
                  const zip = event.target.value.replace(/\D/g, "").slice(0, 5);
                  care.updateProfile({ zip });
                }}
                placeholder="ZIP code"
                value={care.profile.zip}
              />
            </PrefRow>
            <PrefRow
              editing={editing === "times"}
              icon={<IconCalendar />}
              label="Preferred times"
              onEdit={() => setEditing(editing === "times" ? null : "times")}
              value={care.preferences.preferredTimes}
            >
              <select
                className={styles.input}
                onChange={(event) => {
                  care.updatePreferences({ preferredTimes: event.target.value });
                  setEditing(null);
                }}
                value={care.preferences.preferredTimes}
              >
                {timeChoices.map((choice) => (
                  <option key={choice}>{choice}</option>
                ))}
              </select>
            </PrefRow>
            <PrefRow
              editing={editing === "pay"}
              icon={<IconCard />}
              label="Payment method"
              onEdit={() => setEditing(editing === "pay" ? null : "pay")}
              value={care.preferences.paymentLabel}
            >
              <select
                className={styles.input}
                onChange={(event) => {
                  const payment =
                    event.target.value === "self"
                      ? "self"
                      : event.target.value === "later"
                        ? "later"
                        : "insurance";
                  care.updateProfile({ payment });
                  setEditing(null);
                }}
                value={care.profile.payment}
              >
                <option value="insurance">Insurance</option>
                <option value="self">Self-pay (estimate prices)</option>
                <option value="later">Decide at the visit</option>
              </select>
            </PrefRow>
            <button
              className={styles.btnPrimaryWide}
              onClick={() => router.push("/appointments/results")}
              type="button"
            >
              Find options
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

function PrefRow({
  icon,
  label,
  value,
  editing,
  onEdit,
  children,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  editing: boolean;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.prefRow}>
      <span className={styles.iconBubble}>{icon}</span>
      <div>
        <strong>{label}</strong>
        {editing ? children : <p>{value}</p>}
      </div>
      <button onClick={onEdit} type="button">
        {editing ? "Close" : "Edit"}
      </button>
    </div>
  );
}
