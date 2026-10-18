import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";

import { signInWithGoogleToChat, signOutUser } from "@/app/auth-actions";
import styles from "@/app/workspace.module.css";
import { auth } from "@/auth";

import { ChatPanel } from "./chat-panel";

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatLoading />}>
      <ChatGate />
    </Suspense>
  );
}

function ChatLoading() {
  return (
    <main className={styles.dashboardPage}>
      <section className={styles.dashboardShell}>
        <div className={styles.loadingCard}>Loading the test chat…</div>
      </section>
    </main>
  );
}

async function ChatGate() {
  await connection();
  const session = await auth();

  if (!session?.user) {
    return (
      <main className={styles.page}>
        <section className={styles.loginCard}>
          <div className={styles.brandMark}>C</div>
          <p className={styles.eyebrow}>Prompt testing</p>
          <h1>Sign in to test the chatbot.</h1>
          <p className={styles.summary}>
            The test page uses the same Google session as the chat routes.
          </p>
          <form action={signInWithGoogleToChat} className={styles.loginForm}>
            <button className={styles.primaryButton} type="submit">
              Continue with Google
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.dashboardPage}>
      <section className={styles.dashboardShell}>
        <header className={styles.dashboardHeader}>
          <div className={styles.wordmark}>
            <span>C</span>
            Assurance
          </div>
          <nav className={styles.headerNav}>
            <Link href="/dashboard">Dashboard</Link>
          </nav>
          <div className={styles.accountArea}>
            <div>
              <strong>{session.user.name ?? "Signed-in user"}</strong>
              {session.user.email ? <span>{session.user.email}</span> : null}
            </div>
            <form action={signOutUser}>
              <button className={styles.secondaryButton} type="submit">
                Sign out
              </button>
            </form>
          </div>
        </header>

        <ChatPanel />
      </section>
    </main>
  );
}
