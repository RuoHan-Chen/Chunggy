"use client";

import Link from "next/link";

import { IconCalendar, IconPin } from "@/components/careway/icons";
import { useCare } from "@/components/careway/provider";
import { isOpenAppointment, visitTypeLabel } from "@/lib/careway/model";
import styles from "@/components/careway/careway.module.css";

export function AppointmentsView() {
  const care = useCare();
  const history = care.appointments.length > 0 ? care.appointments : care.appointment ? [care.appointment] : [];
  const upcoming = history.filter((item) => isOpenAppointment(item.status));
  const cancelled = history.filter((item) => item.status === "cancelled");

  return (
    <div className={styles.page}>
      <header className={styles.pageIntro}>
        <h1>Appointments</h1>
        <p>Upcoming visits and anything you’ve cancelled.</p>
      </header>
      <div className={styles.stackWide}>
        <section className={styles.card}>
          <h2>Upcoming</h2>
          {upcoming.length > 0 ? upcoming.map((item) => (
            <article className={styles.visitRow} key={item.appointmentId ?? item.reference}>
              <div>
                <strong>{visitTypeLabel(item.visitType)}</strong>
                <p>{item.provider}</p>
                <p>{item.simulated ? "Simulated request · office not contacted" : item.status}</p>
                <p>
                  <IconCalendar /> {item.longDate} · {item.timeLabel}
                </p>
                <p>
                  <IconPin /> {item.address}, {item.cityLine}
                </p>
              </div>
              <Link
                className={styles.btnOutline}
                href="/appointments/confirmed"
                onClick={() => care.focusAppointment(item.appointmentId ?? item.reference)}
              >
                View
              </Link>
            </article>
          )) : (
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
          {cancelled.length > 0 ? cancelled.map((item) => (
            <article className={styles.visitRow} key={item.appointmentId ?? item.reference}>
              <div>
                <strong>{visitTypeLabel(item.visitType)}</strong>
                <p>
                  {item.provider} · {item.dateLabel}
                </p>
                <p>Cancelled · office not contacted</p>
              </div>
              <Link className={styles.btnOutline} href="/appointments/results">
                Book again
              </Link>
            </article>
          )) : (
            <p className={styles.cardLede}>Cancelled visits will show up here.</p>
          )}
        </section>
      </div>
    </div>
  );
}
