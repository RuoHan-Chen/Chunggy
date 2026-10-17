import { signInWithGoogle } from "@/app/auth-actions";
import styles from "@/app/workspace.module.css";

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <section className={styles.loginCard}>
        <div className={styles.brandMark}>C</div>
        <p className={styles.eyebrow}>Chunggy workspace</p>
        <h1>Sign in to view the shared database.</h1>
        <p className={styles.summary}>
          Continue with Google to open the protected Oracle database dashboard.
          Database credentials stay on the server.
        </p>

        <form action={signInWithGoogle} className={styles.loginForm}>
          <button className={styles.primaryButton} type="submit">
            <span aria-hidden="true" className={styles.googleMark}>
              G
            </span>
            Continue with Google
          </button>
        </form>

        <p className={styles.securityNote}>
          Authentication is handled by Google and Auth.js. Chunggy never sees
          your Google password.
        </p>
      </section>
    </main>
  );
}
