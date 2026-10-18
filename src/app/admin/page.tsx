import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import { signOutUser } from "@/app/auth-actions";
import { auth } from "@/auth";
import { getDatabaseOverview } from "@/lib/db";
import { getIntegrationStatus } from "@/lib/env";
import { readFoundationTables, type FoundationTable, type FoundationTablePreview } from "@/server/database/foundation-preview";

import styles from "./admin.module.css";
import { DemoPanel } from "./demo-panel";

export const metadata = { title: "Admin" };

export const instant = false;

export default function AdminPage() {
  return (
    <main className={styles.page}>
      <Suspense fallback={<p className={styles.frame}>Loading admin…</p>}>
        <AdminScreen />
      </Suspense>
    </main>
  );
}

async function AdminScreen() {
  await connection();
  const session = await auth();
  if (!session?.user) redirect("/login");

  const email = session.user.email || "";
  const name = session.user.name || "Assurance member";
  const status = getIntegrationStatus();
  let database: Awaited<ReturnType<typeof getDatabaseOverview>> | null = null;
  let tables: FoundationTablePreview[] | null = null;
  let databaseError = false;
  let tableError = false;

  try {
    database = await getDatabaseOverview();
  } catch (error) {
    console.error("Admin database overview failed", error);
    databaseError = true;
  }

  if (database) {
    try {
      tables = await readFoundationTables();
    } catch (error) {
      console.error("Admin foundation table read failed", error);
      tableError = true;
    }
  }
  const workflowMetrics: Array<{ label: string; table: FoundationTable; detail: string }> = [
    { label: "Conversations", table: "CONVERSATIONS", detail: "Persistent assistant chats" },
    { label: "Care requests", table: "CARE_REQUESTS", detail: "Appointment searches" },
    { label: "Options", table: "APPOINTMENT_OPTIONS", detail: "Catalog and Vapi times" },
    { label: "Appointments", table: "APPOINTMENTS", detail: "Saved or requested visits" },
    { label: "Outreach", table: "OUTREACH_ATTEMPTS", detail: "Vapi and notification attempts" },
  ];

  return (
    <div className={styles.frame}>
      <header className={styles.header}>
        <div>
          <p className={styles.wordmark}>Assurance</p>
          <p className={styles.lede}>Admin</p>
        </div>
        <div className={styles.account}>
          <div>
            <strong>{name}</strong>
            <span>{email}</span>
          </div>
          <Link className={styles.textLink} href="/home">
            Home
          </Link>
          <form action={signOutUser}>
            <button className={styles.button} type="submit">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <section className={styles.section}>
        <h1>Integrations</h1>
        <p className={styles.lede}>Whether each integration has its required environment variables. Values stay on the server.</p>
        <ul className={styles.statusList}>
          <li>Oracle: {status.oracle ? "configured" : "not configured"}</li>
          <li>Google auth: {status.auth ? "configured" : "not configured"}</li>
          <li>OpenAI: {status.openai ? "configured" : "not configured"}</li>
          <li>OCI Generative AI: {status.oracleAi ? "configured" : "not configured"}</li>
          <li>Vapi doctor calls: {status.vapi ? "configured" : "not configured"}</li>
        </ul>
      </section>

      {tables ? (
        <section className={styles.section}>
          <h2>Care workflow</h2>
          <p className={styles.lede}>Live row counts for the user journey from assistant chat through office outreach.</p>
          <div className={styles.workflowGrid}>
            {workflowMetrics.map((metric) => (
              <article className={styles.workflowCard} key={metric.table}>
                <strong>{tables.find((table) => table.table === metric.table)?.count ?? 0}</strong>
                <span>{metric.label}</span>
                <small>{metric.detail}</small>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.section}>
        <h2>Database</h2>
        <p
          className={`${styles.connectionStatus} ${databaseError || !database ? styles.connectionDown : styles.connectionUp}`}
          role="status"
        >
          {databaseError || !database ? "Oracle disconnected" : "Oracle connected"}
        </p>
        {databaseError || !database ? (
          <p className={styles.error}>Oracle could not be reached. Check the wallet, environment variables, and network, then reload.</p>
        ) : (
          <>
            <p className={styles.lede}>Read-only metadata and the latest rows from foundation and care-workflow tables.</p>
            <ul className={styles.metrics}>
              <li>Database: {database.databaseName}</li>
              <li>Schema: {database.currentUser}</li>
              <li>Tables: {database.tableCount}</li>
              <li>Service: {database.serviceName}</li>
            </ul>
            {tableError || !tables ? (
              <p className={styles.error}>The connection worked, but the foundation tables could not be read.</p>
            ) : (
              tables.map((table) => (
                <div className={styles.tableBlock} key={table.table}>
                  <h3>{table.table}</h3>
                  <p>
                    {table.count} {table.count === 1 ? "row" : "rows"}. Showing the latest 25.
                  </p>
                  {table.rows.length === 0 ? (
                    <div className={styles.empty}>No rows.</div>
                  ) : (
                    <div className={styles.scroll}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            {table.columns.map((column) => (
                              <th key={column} scope="col">
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {table.rows.map((row, index) => (
                            <tr key={`${table.table}-${index}`}>
                              {row.map((value, cellIndex) => (
                                <td key={`${table.columns[cellIndex]}-${index}`}>{value || "—"}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        )}
      </section>

      <DemoPanel email={email} name={name} />
    </div>
  );
}
