import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signOutUser } from "@/app/auth-actions";
import styles from "@/app/workspace.module.css";
import { auth } from "@/auth";
import { getDatabaseOverview } from "@/lib/db";

export default function DashboardPage() {
  return (
    <main className={styles.dashboardPage}>
      <Suspense fallback={<DashboardLoading />}>
        <DatabaseDashboard />
      </Suspense>
    </main>
  );
}

function DashboardLoading() {
  return (
    <section className={styles.dashboardShell}>
      <div className={styles.loadingCard}>Loading your workspace…</div>
    </section>
  );
}

async function DatabaseDashboard() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  let database;

  try {
    database = await getDatabaseOverview();
  } catch {
    console.error("Failed to load the authenticated database dashboard");

    return (
      <section className={styles.dashboardShell}>
        <DashboardHeader
          email={session.user.email}
          name={session.user.name}
        />
        <div className={styles.errorCard}>
          <p className={styles.eyebrow}>Database unavailable</p>
          <h1>Oracle could not be reached.</h1>
          <p>
            Check the server wallet, Oracle environment variables, and network
            access, then reload this page.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.dashboardShell}>
      <DashboardHeader email={session.user.email} name={session.user.name} />

      <div className={styles.heroRow}>
        <div>
          <p className={styles.eyebrow}>Oracle database</p>
          <h1>{database.databaseName}</h1>
          <p className={styles.summary}>
            Live, read-only metadata from the shared database.
          </p>
        </div>
        <span className={styles.connectedBadge}>
          <span aria-hidden="true" /> Connected
        </span>
      </div>

      <dl className={styles.metricsGrid}>
        <div>
          <dt>Current schema</dt>
          <dd>{database.currentUser}</dd>
        </div>
        <div>
          <dt>Tables</dt>
          <dd>{database.tableCount}</dd>
        </div>
        <div>
          <dt>Service</dt>
          <dd title={database.serviceName}>{database.serviceName}</dd>
        </div>
        <div>
          <dt>Database time</dt>
          <dd>{database.databaseTime}</dd>
        </div>
      </dl>

      <section className={styles.tablesCard}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Schema browser</p>
            <h2>Available tables</h2>
          </div>
          <span>Showing up to 20</span>
        </div>

        {database.tables.length > 0 ? (
          <ul className={styles.tableList}>
            {database.tables.map((table) => (
              <li key={table}>
                <span aria-hidden="true">▦</span>
                <code>{table}</code>
              </li>
            ))}
          </ul>
        ) : (
          <div className={styles.emptyState}>
            <p>No tables exist in this schema yet.</p>
            <span>The connection is working and ready for migrations.</span>
          </div>
        )}
      </section>
    </section>
  );
}

function DashboardHeader({
  email,
  name,
}: {
  email?: string | null;
  name?: string | null;
}) {
  return (
    <header className={styles.dashboardHeader}>
      <div className={styles.wordmark}>
        <span>C</span>
        Assurance
      </div>
      <nav className={styles.headerNav}>
        <Link href="/chat">Test chat</Link>
      </nav>
      <div className={styles.accountArea}>
        <div>
          <strong>{name ?? "Signed-in user"}</strong>
          {email ? <span>{email}</span> : null}
        </div>
        <form action={signOutUser}>
          <button className={styles.secondaryButton} type="submit">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
