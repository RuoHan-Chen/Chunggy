"use client";

import Link from "next/link";
import { useState } from "react";

import {
  IconCalendar,
  IconCheck,
  IconClock,
  IconDoc,
  IconId,
  IconPin,
} from "@/components/careway/icons";
import { useCare } from "@/components/careway/provider";
import { firstName, mapsUrl, toIcs } from "@/lib/careway/model";
import styles from "@/components/careway/careway.module.css";

export function ConfirmedView() {
  const care = useCare();
  const [cancelOpen, setCancelOpen] = useState(false);
  const appointment = care.appointment;
  const name = firstName(care.profile.fullName || care.user.name);

  if (!appointment) {
    return (
      <div className={styles.page}>
        <header className={styles.pageIntro}>
          <h1>No visit to show yet</h1>
          <p>When you request a time, the confirmation will land here.</p>
        </header>
        <Link className={styles.btnPrimary} href="/assistant">
          Find a visit
        </Link>
      </div>
    );
  }

  const cancelled = appointment.status === "cancelled";

  function downloadCalendar() {
    const file = new Blob([toIcs(appointment!, care.profile.fullName || name)], {
      type: "text/calendar",
    });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${appointment!.reference}.ics`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={styles.page}>
      <header className={styles.confirmHero}>
        <span className={cancelled ? styles.heroCancel : styles.heroCheck}>
          <IconCheck size={28} />
        </span>
        <div>
          <h1>{cancelled ? `Visit cancelled, ${name}.` : `You’re booked, ${name}.`}</h1>
          <p>
            {cancelled
              ? "This time is off your schedule. You can pick another opening whenever you’re ready."
              : "Your appointment has been confirmed by the office. We’ve sent a confirmation details to your email and you can also view it in your appointments."}
          </p>
        </div>
      </header>

      <div className={styles.confirmGrid}>
        <section className={styles.card}>
          <span className={cancelled ? styles.badgeMuted : styles.badge}>
            <IconCheck size={14} /> {cancelled ? "Cancelled" : "Confirmed by office"}
          </span>
          <h2>{appointment.visitType}</h2>
          <p className={styles.provider}>{appointment.provider}</p>
          <ul className={styles.detailList}>
            <li>
              <IconCalendar />
              <span>
                {appointment.longDate}
                <small>
                  {appointment.timeLabel} – {appointment.endLabel}
                </small>
              </span>
            </li>
            <li>
              <IconPin />
              <span>
                {appointment.address}
                <small>{appointment.cityLine}</small>
              </span>
            </li>
            <li>
              <IconDoc />
              <span>
                Appointment reference
                <small>{appointment.reference}</small>
              </span>
            </li>
          </ul>
          <div className={styles.actions}>
            <button className={styles.btnPrimary} onClick={downloadCalendar} type="button">
              <IconCalendar /> Add to calendar
            </button>
            <a
              className={styles.btnOutline}
              href={mapsUrl(appointment)}
              rel="noreferrer"
              target="_blank"
            >
              <IconPin /> Get directions
            </a>
          </div>
        </section>

        <section className={styles.card}>
          <h2>Next steps</h2>
          <div className={styles.sideItem}>
            <span className={styles.iconBubble}>
              <IconId />
            </span>
            <div>
              <strong>Bring a photo ID</strong>
              <p>Show a valid government-issued ID at check-in.</p>
            </div>
          </div>
          <div className={styles.sideItem}>
            <span className={styles.iconBubble}>
              <IconClock />
            </span>
            <div>
              <strong>Arrive 10 minutes early</strong>
              <p>This gives you time to check in and complete any needed forms.</p>
            </div>
          </div>
          <div className={styles.sideItem}>
            <span className={styles.iconBubble}>
              <IconDoc />
            </span>
            <div>
              <strong>Ask the office about final cost</strong>
              <p>Your visit may include additional services. Confirm the final cost with the office.</p>
            </div>
          </div>
          <hr />
          <p className={styles.kicker}>Estimated cost (not final)</p>
          <p className={styles.price}>{appointment.estimate}</p>
          <p className={styles.fine}>
            This is an estimate based on typical self-pay rates for a routine {appointment.visitType.toLowerCase()}.
            The final cost may vary.
          </p>
        </section>
      </div>

      <section className={styles.manage}>
        <div>
          <h2>Manage your appointment</h2>
          <div className={styles.manageActions}>
            <Link href="/appointments/results">
              <IconCalendar /> Reschedule appointment <span aria-hidden="true">›</span>
            </Link>
            <span className={styles.vRule} />
            <button disabled={cancelled} onClick={() => setCancelOpen(true)} type="button">
              <span className={styles.cancelMark}>×</span> Cancel appointment <span aria-hidden="true">›</span>
            </button>
          </div>
        </div>
        <Link className={styles.btnOutline} href="/appointments">
          View all appointments <span aria-hidden="true">›</span>
        </Link>
      </section>

      {cancelOpen ? (
        <div className={styles.modal} role="presentation">
          <div aria-modal="true" className={styles.modalCard} role="dialog">
            <h2>Cancel this appointment?</h2>
            <p className={styles.cardLede}>
              {appointment.provider} will come off your upcoming list. This preview doesn’t contact the office.
            </p>
            <div className={styles.actions}>
              <button className={styles.btnOutline} onClick={() => setCancelOpen(false)} type="button">
                Keep appointment
              </button>
              <button
                className={styles.btnDanger}
                onClick={() => {
                  care.cancelAppointment();
                  setCancelOpen(false);
                }}
                type="button"
              >
                Cancel appointment
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
