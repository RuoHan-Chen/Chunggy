import styles from "./page.module.css";

const setupItems = [
  ["Next.js server", "Ready"],
  ["Oracle connection", "Waiting for credentials"],
  ["Google authentication", "Waiting for OAuth credentials"],
  ["OpenAI client", "Waiting for an API key"],
] as const;

export default function Home() {
  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.eyebrow}>Basic server setup</p>
        <h1>Chunggy is ready for credentials.</h1>
        <p className={styles.summary}>
          The server foundation is in place without product logic or committed
          secrets. Add local environment variables to activate each integration.
        </p>

        <dl className={styles.statusList}>
          {setupItems.map(([label, status]) => (
            <div className={styles.statusRow} key={label}>
              <dt>{label}</dt>
              <dd>{status}</dd>
            </div>
          ))}
        </dl>

        <p className={styles.hint}>
          Start with <code>.env.example</code>, then check <code>/api/health</code>.
        </p>
      </section>
    </main>
  );
}
