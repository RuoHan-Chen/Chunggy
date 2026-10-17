"use client";

import { useState } from "react";

import styles from "@/app/workspace.module.css";

type ChatProvider = "oci" | "openai";

const providerOptions: { id: ChatProvider; label: string; endpoint: string }[] = [
  { id: "oci", label: "OCI", endpoint: "/api/chat/oracle" },
  { id: "openai", label: "OpenAI", endpoint: "/api/chat/openai" },
];

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  provider?: string;
  model?: string;
};

type ChatResponse = {
  error?: string;
  message?: string;
  text?: string;
  model?: string;
};

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [provider, setProvider] = useState<ChatProvider>("oci");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();

    if (!message || pending) {
      return;
    }

    const selected = providerOptions.find((option) => option.id === provider) ?? providerOptions[0];

    setDraft("");
    setError(null);
    setPending(true);
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", text: message },
    ]);

    try {
      const response = await fetch(selected.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const payload = (await response.json()) as ChatResponse;

      if (!response.ok || !payload.text) {
        setError(describeError(response.status, payload, selected.label));
        return;
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: payload.text ?? "",
          provider: selected.label,
          model: payload.model,
        },
      ]);
    } catch {
      setError("The request could not be completed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className={styles.chatCard}>
      <div aria-live="polite" className={styles.chatLog}>
        {messages.length === 0 ? (
          <div className={styles.chatEmpty}>
            <strong>Test a prompt</strong>
            <span>Choose OCI or OpenAI, then send a prompt. The conversation is not saved.</span>
          </div>
        ) : (
          messages.map((message) => (
            <article
              className={`${styles.message} ${
                message.role === "user" ? styles.messageUser : styles.messageAssistant
              }`}
              key={message.id}
            >
              {message.role === "assistant" ? (
                <span className={styles.messageMeta}>
                  {[message.provider, message.model].filter(Boolean).join(" · ") || "Assistant"}
                </span>
              ) : null}
              <p>{message.text}</p>
            </article>
          ))
        )}
      </div>

      {error ? (
        <p className={styles.chatError} role="alert">
          {error}
        </p>
      ) : null}

      <form className={styles.chatComposer} onSubmit={onSubmit}>
        <fieldset className={styles.providerSwitch}>
          <legend>Model provider</legend>
          {providerOptions.map((option) => (
            <label className={styles.providerOption} key={option.id}>
              <input
                checked={provider === option.id}
                disabled={pending}
                name="provider"
                onChange={() => setProvider(option.id)}
                type="radio"
                value={option.id}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
        <div className={styles.composerRow}>
          <textarea
            aria-label="Prompt"
            className={styles.chatTextarea}
            id="chat-message"
            name="message"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Ask something to test the model"
            value={draft}
          />
          <button className={styles.chatSubmit} disabled={pending || !draft.trim()} type="submit">
            {pending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </section>
  );
}

function describeError(status: number, payload: ChatResponse, providerLabel: string) {
  if (payload.message) {
    return payload.message;
  }

  if (status === 401 || payload.error === "unauthorized") {
    return "Sign in again, then retry the prompt.";
  }

  if (payload.error === "not_configured") {
    return `${providerLabel} is not configured.`;
  }

  if (status === 502 || payload.error === "upstream_error") {
    return `${providerLabel} rejected the request.`;
  }

  return "The prompt could not be sent.";
}
