"use client";

import Link from "next/link";

import {
  IconCalendar,
  IconChat,
  IconPin,
  IconUser,
} from "@/components/careway/icons";
import { useCare } from "@/components/careway/provider";
import { languageLocale, translate } from "@/lib/careway/i18n";
import { digits, firstName, isOpenAppointment, visitTypeLabel } from "@/lib/careway/model";
import styles from "@/components/careway/careway.module.css";

export function HomeView() {
  const care = useCare();
  const t = (text: string) => translate(care.profile.language, text);
  const locale = languageLocale(care.profile.language);
  const name = firstName(care.profile.fullName || care.user.name);
  const hour = new Date().getHours();
  const hello = t(hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
  const visit = care.appointments.find((item) => isOpenAppointment(item.status))
    ?? (care.appointment && isOpenAppointment(care.appointment.status) ? care.appointment : null);
  const needsPhone = digits(care.profile.phone).length !== 10;

  return (
    <div className={styles.page}>
      <header className={styles.pageIntro}>
        <h1>
          {hello}, {name}.
        </h1>
        <p>{t("Find a visit, keep your details current, and see what’s coming up.")}</p>
      </header>

      {needsPhone ? (
        <div className={styles.banner}>
          <div>
            <strong>{t("Add your phone number")}</strong>
            <p>{t("Offices use it for reminders and last-minute schedule changes.")}</p>
          </div>
          <Link className={styles.btnPrimary} href="/onboarding">
            {t("Add phone number")}
          </Link>
        </div>
      ) : null}

      <div className={styles.split}>
        <section className={styles.card}>
          {visit ? (
            <>
              <p className={styles.kicker}>{t("Upcoming")}</p>
              <h2>{t(visitTypeLabel(visit.visitType))}</h2>
              <p className={styles.provider}>{visit.provider}</p>
              <ul className={styles.detailList}>
                <li>
                  <IconCalendar />
                  <span>
                    {new Intl.DateTimeFormat(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Chicago" }).format(new Date(visit.startIso))}
                    <small>
                      {new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }).format(new Date(visit.startIso))}
                      {" – "}
                      {new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }).format(new Date(visit.endIso))}
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
                {t("View request")}
              </Link>
            </>
          ) : (
            <>
              <p className={styles.kicker}>{t("Next step")}</p>
              <h2>{t("Find a visit")}</h2>
              <p className={styles.cardLede}>
                {t("Tell the assistant what you need. You’ll review the time before anything is requested.")}
              </p>
              <Link className={styles.btnPrimary} href="/assistant">
                {t("Open the assistant")}
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
              <strong>{t("Care assistant")}</strong>
              {t("Scheduling help and general questions.")}
            </span>
          </Link>
          <Link className={styles.jump} href="/appointments">
            <span className={styles.iconBubble}>
              <IconCalendar />
            </span>
            <span>
              <strong>{t("Appointments")}</strong>
              {t("See upcoming and past visits.")}
            </span>
          </Link>
          <Link className={styles.jump} href="/profile">
            <span className={styles.iconBubble}>
              <IconUser />
            </span>
            <span>
              <strong>{t("Profile & insurance")}</strong>
              {t("Phone, coverage, and payment choice.")}
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}
