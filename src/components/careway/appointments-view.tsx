"use client";

import Link from "next/link";

import { IconCalendar, IconPin } from "@/components/careway/icons";
import { useCare } from "@/components/careway/provider";
import styles from "@/components/careway/careway.module.css";

export function AppointmentsView() {
  const { appointment } = useCare();
  const upcoming = appointment?.status === "confirmed" ? appointment : null;
  const cancelled = appointment?.status === "cancelled" ? appointment : null;

  return (
    <div className={styles.page}>
      <header className={styles.pageIntro}>
        <h1>Appointments</h1>
        <p>Upcoming visits and anything you’ve cancelled.</p>
      </header>
      <div className={styles.stackWide}>
        <section className={styles.card}>
          <h2>Upcoming</h2>
          {upcoming ? (
            <article className={styles.visitRow}>
              <div>
                <strong>{upcoming.visitType}</strong>
                <p>{upcoming.provider}</p>
                <p>
                  <IconCalendar /> {upcoming.longDate} · {upcoming.timeLabel}
                </p>
                <p>
                  <IconPin /> {upcoming.address}, {upcoming.cityLine}
                </p>
              </div>
              <Link className={styles.btnOutline} href="/appointments/confirmed">
                View
              </Link>
            </article>
          ) : (
            <div className={styles.empty}>
              <p>No upcoming visits.</p>
              <Link className={styles.btnPrimary} href="/assistant">
                Find a visit
              </Link>
            </div>
          )}
        </section>
        <section className={styles.card}>
          <h2>Cancelled</h2>
          {cancelled ? (
            <article className={styles.visitRow}>
              <div>
                <strong>{cancelled.visitType}</strong>
                <p>
                  {cancelled.provider} · {cancelled.dateLabel}
                </p>
              </div>
              <Link className={styles.btnOutline} href="/appointments/results">
                Book again
              </Link>
            </article>
          ) : (
            <p className={styles.cardLede}>Cancelled visits will show up here.</p>
          )}
        </section>
      </div>
    </div>
  );
}
