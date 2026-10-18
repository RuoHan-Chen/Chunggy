import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import { signInWithGoogle } from "@/app/auth-actions";
import { auth } from "@/auth";
import {
  Cityscape,
  GoogleMark,
  IconCalendar,
  IconDoc,
  IconPin,
  LeafMark,
} from "@/components/careway/icons";
import { LanguageMenu } from "@/components/careway/language-menu";
import styles from "@/components/careway/careway.module.css";

export const metadata = {
  title: "Sign in",
};

export const instant = false;

function LoginScreen({ error }: { error?: string }) {
  return (
    <main className={styles.login}>
      <section className={styles.hero}>
        <div className={styles.wordmark}>
          <LeafMark />
          Assurance
        </div>
        <h1>
          Less calling.
          <br />
          More caring.
        </h1>
        <p className={styles.heroLead}>
          Your personal healthcare appointment concierge, here to make care simpler.
        </p>
        <div className={styles.features}>
          <article className={styles.feature}>
            <span className={styles.iconBubble}>
              <IconPin />
            </span>
            <div>
              <strong>Find care nearby</strong>
              <p>Discover trusted providers and appointment times in your area.</p>
            </div>
          </article>
          <article className={styles.feature}>
            <span className={styles.iconBubble}>
              <IconDoc />
            </span>
            <div>
              <strong>Compare your options</strong>
              <p>See availability, locations, estimated prices, and patient reviews.</p>
            </div>
          </article>
          <article className={styles.feature}>
            <span className={styles.iconBubble}>
              <IconCalendar />
            </span>
            <div>
              <strong>Keep visits organized</strong>
              <p>Manage your appointments, documents, and reminders all in one place.</p>
            </div>
          </article>
        </div>
        <div className={styles.cityWrap}>
          <Cityscape />
        </div>
      </section>
      <section className={styles.panel}>
        <div className={styles.langFloat}>
          <LanguageMenu />
        </div>
        <div className={styles.panelInner}>
          <h1>Welcome to Assurance</h1>
          <p className={styles.panelLead}>Find and book care with a little help.</p>
          {error ? (
            <p className={styles.authError}>Google sign-in didn’t complete. Try again in a moment.</p>
          ) : null}
          <form action={signInWithGoogle}>
            <button className={styles.googleButton} type="submit">
              <span className={styles.gBadge}>
                <GoogleMark />
              </span>
              Continue with Google
            </button>
          </form>
          <p className={styles.accountNote}>
            New to Assurance? Continuing with Google creates your account.
          </p>
        </div>
      </section>
    </main>
  );
}

async function LoginGate({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await connection();
  const session = await auth();
  if (session?.user) redirect("/home");
  const params = await searchParams;
  return <LoginScreen error={params.error} />;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className={styles.loadingPlain}>
          <p>Loading Assurance…</p>
        </div>
      }
    >
      <LoginGate searchParams={searchParams} />
    </Suspense>
  );
}
