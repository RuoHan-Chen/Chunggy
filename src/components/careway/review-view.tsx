"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { IconCalendar, IconCard, IconCheck, IconClock, IconPin, IconTooth, IconUser } from "@/components/careway/icons";
import { useCare } from "@/components/careway/provider";
import { bornLabel, digits, paymentTitle } from "@/lib/careway/model";
import styles from "@/components/careway/careway.module.css";

export function ReviewView() {
  const care = useCare();
  const router = useRouter();
  const [share, setShare] = useState(false);
  const [sms, setSms] = useState(true);
  const [error, setError] = useState("");
  const slot = care.draft;
  const phoneReady = digits(care.profile.phone).length === 10;
  const name = care.profile.fullName || care.user.name || "Add your name";

  function confirm() {
    if (!slot) return;
    if (!phoneReady) {
      setError("Add a phone number before requesting this visit.");
      return;
    }
    if (!share) {
      setError("Allow Chunggy to share these details with the office.");
      return;
    }
    care.bookDraft(sms);
    router.push("/appointments/confirmed");
  }

  if (!slot) {
    return (
      <div className={styles.page}>
        <header className={styles.pageIntro}>
          <h1>Choose a time first</h1>
          <p>Review opens after you pick a visit from the results.</p>
        </header>
        <Link className={styles.btnPrimary} href="/appointments/results">
          See options
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <p className={styles.crumb}>
        <Link href="/appointments/results">Results</Link>
        <span>›</span>
        Review
      </p>
      <header className={styles.pageIntro}>
        <h1>Review before we book</h1>
        <p>Take a moment to confirm your details. We’ll request this appointment with the office.</p>
      </header>
      <ol className={styles.stepperLeft}>
        <li className={styles.stepDone}>
          <span>
            <IconCheck size={14} />
          </span>
          Choose care
        </li>
        <li className={styles.stepCurrent}>
          <span>2</span>
          Review details
        </li>
        <li>
          <span>3</span>
          Confirmation
        </li>
      </ol>

      <div className={styles.reviewGrid}>
        <div className={styles.stack}>
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2>Appointment</h2>
              <Link href="/appointments/results">Edit</Link>
            </div>
            <div className={styles.reviewBlock}>
              <span className={styles.iconBubble}>
                <IconTooth />
              </span>
              <div>
                <strong>{slot.visitType}</strong>
                <p>{slot.provider}</p>
                <p>
                  <IconCalendar /> {slot.dateLabel}
                  <IconClock /> {slot.timeLabel} ({slot.duration})
                </p>
                <p>
                  <IconPin /> {slot.address}, {slot.cityLine}
                </p>
              </div>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2>Patient details</h2>
              <Link href="/onboarding">Edit</Link>
            </div>
            <div className={styles.reviewBlock}>
              <span className={styles.iconBubble}>
                <IconUser />
              </span>
              <div>
                <strong>{name}</strong>
                <p>{bornLabel(care.profile.dateOfBirth)}</p>
                <p>{phoneReady ? care.profile.phone : "Phone number needed"}</p>
              </div>
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2>Payment</h2>
              <Link href="/profile">Edit</Link>
            </div>
            <div className={styles.reviewBlock}>
              <span className={styles.iconBubble}>
                <IconCard />
              </span>
              <div>
                <strong>{paymentTitle(care.profile.payment)}</strong>
                <p>Estimated visit cost {slot.estimate}</p>
                <p>Final amount confirmed by the office.</p>
              </div>
            </div>
          </section>

          <section className={styles.card}>
            <label className={styles.check}>
              <input
                checked={share}
                onChange={(event) => setShare(event.target.checked)}
                type="checkbox"
              />
              <span>
                I authorize Chunggy to share these details with this office to request this appointment.
                <small>
                  This includes your name, phone number, contact information, appointment details, and
                  insurance or payment information (if applicable).
                </small>
              </span>
            </label>
            <label className={styles.check}>
              <input
                checked={sms}
                onChange={(event) => setSms(event.target.checked)}
                type="checkbox"
              />
              <span>
                Send me SMS reminders (optional)
                <small>
                  {phoneReady
                    ? `Get appointment updates and reminders at ${care.profile.phone}.`
                    : "Add a phone number to get text reminders."}
                </small>
              </span>
            </label>
            {error ? <p className={styles.formError}>{error}</p> : null}
          </section>
        </div>

        <aside className={styles.summaryCard}>
          <h2>Booking summary</h2>
          <strong>{slot.visitType}</strong>
          <p>{slot.provider}</p>
          <p>
            <IconCalendar /> {slot.dateLabel}
          </p>
          <p>
            <IconClock /> {slot.timeLabel} ({slot.duration})
          </p>
          <p>
            <IconPin /> {slot.address}, {slot.cityLine}
          </p>
          <hr />
          <h3>Patient</h3>
          <p>{name}</p>
          <p>{bornLabel(care.profile.dateOfBirth)}</p>
          <p>{phoneReady ? care.profile.phone : "Add a phone number"}</p>
          <hr />
          <h3>Payment</h3>
          <p>{paymentTitle(care.profile.payment)}</p>
          <p>Estimated visit cost {slot.estimate}</p>
          <p>Final amount confirmed by the office.</p>
          <button className={styles.btnPrimaryWide} onClick={confirm} type="button">
            Confirm and request booking
          </button>
          <p className={styles.fine}>You’ll see confirmation after the office accepts.</p>
        </aside>
      </div>

      <Link className={styles.backLink} href="/appointments/results">
        ← Back to results
      </Link>
    </div>
  );
}
