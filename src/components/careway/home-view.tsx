"use client";

import Link from "next/link";

import {
  IconCalendar,
  IconChat,
  IconPin,
  IconUser,
} from "@/components/careway/icons";
import { useCare } from "@/components/careway/provider";
import { digits, firstName, isOpenAppointment, visitTypeLabel } from "@/lib/careway/model";
import styles from "@/components/careway/careway.module.css";

export function HomeView() {
  const care = useCare();
  const name = firstName(care.profile.fullName || care.user.name);
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const visit = care.appointments.find((item) => isOpenAppointment(item.status))
    ?? (care.appointment && isOpenAppointment(care.appointment.status) ? care.appointment : null);
  const needsPhone = digits(care.profile.phone).length !== 10;

  return (
    <div className={styles.page}>
      <header className={styles.pageIntro}>
        <h1>
          {hello}, {name}.
        </h1>
        <p>Find a visit, keep your details current, and see what’s coming up.</p>
      </header>

      {needsPhone ? (
        <div className={styles.banner}>
          <div>
            <strong>Add your phone number</strong>
            <p>Offices use it for reminders and last-minute schedule changes.</p>
          </div>
          <Link className={styles.btnPrimary} href="/onboarding">
            Add phone number
          </Link>
        </div>
      ) : null}

      <div className={styles.split}>
        <section className={styles.card}>
          {visit ? (
            <>
              <p className={styles.kicker}>Upcoming</p>
              <h2>{visitTypeLabel(visit.visitType)}</h2>
              <p className={styles.provider}>{visit.provider}</p>
              <ul className={styles.detailList}>
                <li>
                  <IconCalendar />
                  <span>
                    {visit.longDate}
                    <small>
                      {visit.timeLabel} – {visit.endLabel}
                    </small>
                  </span>
                </li>
                <li>
                  <IconPin />
                  <span>
                    {visit.address}
                    <small>{visit.cityLine}</small>
                  </span>
                </li>
              </ul>
              <Link className={styles.btnPrimary} href="/appointments/confirmed">
                View request
              </Link>
            </>
          ) : (
            <>
              <p className={styles.kicker}>Next step</p>
              <h2>Find a visit</h2>
              <p className={styles.cardLede}>
                Tell the assistant what you need. You’ll review the time before anything is requested.
              </p>
              <Link className={styles.btnPrimary} href="/assistant">
                Open the assistant
              </Link>
            </>
          )}
        </section>
        <div className={styles.stack}>
          <Link className={styles.jump} href="/assistant">
            <span className={styles.iconBubble}>
              <IconChat />
            </span>
            <span>
              <strong>Care assistant</strong>
              Scheduling help and general questions.
            </span>
          </Link>
          <Link className={styles.jump} href="/appointments">
            <span className={styles.iconBubble}>
              <IconCalendar />
            </span>
            <span>
              <strong>Appointments</strong>
              See upcoming and past visits.
            </span>
          </Link>
          <Link className={styles.jump} href="/profile">
            <span className={styles.iconBubble}>
              <IconUser />
            </span>
            <span>
              <strong>Profile & insurance</strong>
              Phone, coverage, and payment choice.
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
