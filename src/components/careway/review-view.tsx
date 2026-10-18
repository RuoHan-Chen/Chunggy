"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { IconCalendar, IconCard, IconCheck, IconClock, IconPin, IconTooth, IconUser } from "@/components/careway/icons";
import { useCare } from "@/components/careway/provider";
import { bornLabel, digits, formatPhone, parseDob, paymentTitle } from "@/lib/careway/model";
import styles from "@/components/careway/careway.module.css";

export function ReviewView() {
  const care = useCare();
  const router = useRouter();
  const [share, setShare] = useState(false);
  const [sms, setSms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [profileDirty, setProfileDirty] = useState(false);
  const [insuranceDirty, setInsuranceDirty] = useState(false);
  const [error, setError] = useState("");
  const slot = care.draft;
  const phoneReady = digits(care.profile.phone).length === 10;
  const nameReady = Boolean(care.profile.fullName.trim());
  const dobReady = Boolean(parseDob(care.profile.dateOfBirth));
  const name = care.profile.fullName || care.user.name || "Add your name";
  const needsInsurance = care.profile.payment === "insurance";
  const insuranceReady = Boolean(
    care.profile.insuranceCompany.trim() && care.profile.memberId.trim() && care.profile.planName.trim(),
  );
  const savedOption = care.savedCareRequest?.options.some((option) => option.id === slot?.id) ?? false;

  async function confirm() {
    if (!slot || submitting) return;
    if (!nameReady) {
      setError("Add your name before requesting this visit.");
      return;
    }
    if (!phoneReady) {
      setError("Add a phone number before requesting this visit.");
      return;
    }
    if (!dobReady) {
      setError("Add a date of birth before requesting this visit.");
      return;
    }
    if (needsInsurance && !insuranceReady) {
      setError("Enter the insurer, member ID, and plan name before requesting this visit.");
      return;
    }
    if (!share) {
      setError("Allow Assurance to share these details with the office.");
      return;
    }
    if (care.dataMode === "database" && !savedOption) {
      setError("Choose a time from the saved shortlist.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      if (care.dataMode === "database" && profileDirty) {
        const profileResult = await care.saveProfile();
        if (!profileResult.ok) {
          setError(profileResult.message);
          return;
        }
      }
      if (care.dataMode === "database" && needsInsurance && insuranceDirty) {
        const insuranceResult = await care.saveInsurance();
        if (!insuranceResult.ok) {
          setError(insuranceResult.message);
          return;
        }
      }
      const result = await care.requestAppointment(sms);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push("/appointments/confirmed");
    } finally {
      setSubmitting(false);
    }
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
        <p>Confirm your saved details before a simulated request is stored. The office is not contacted.</p>
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
                <p>{dobReady ? bornLabel(care.profile.dateOfBirth) : "Date of birth needed"}</p>
                <p>{phoneReady ? care.profile.phone : "Phone number needed"}</p>
              </div>
            </div>
            {!care.profile.fullName.trim() ? (
              <label className={styles.field}>
                Full name
                <input
                  className={styles.input}
                  onChange={(event) => {
                    setProfileDirty(true);
                    care.updateProfile({ fullName: event.target.value });
                  }}
                  value={care.profile.fullName}
                />
              </label>
            ) : null}
            {!dobReady ? (
              <label className={styles.field}>
                Date of birth
                <input
                  className={styles.input}
                  inputMode="numeric"
                  onChange={(event) => {
                    setProfileDirty(true);
                    care.updateProfile({ dateOfBirth: event.target.value });
                  }}
                  placeholder="MM / DD / YYYY"
                  value={care.profile.dateOfBirth}
                />
              </label>
            ) : null}
            {!phoneReady ? (
              <label className={styles.field}>
                Phone number
                <input
                  className={styles.input}
                  inputMode="tel"
                  onChange={(event) => {
                    setProfileDirty(true);
                    care.updateProfile({ phone: formatPhone(event.target.value) });
                  }}
                  placeholder="(312) 555-0100"
                  value={care.profile.phone}
                />
              </label>
            ) : null}
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
                <p>Estimate only. The office has not confirmed a price.</p>
                {needsInsurance ? (
                  <p>
                    {insuranceReady
                      ? `${care.profile.insuranceCompany} · ${care.profile.planName} · Member ${care.profile.memberId}`
                      : "Insurer, member ID, and plan name are needed."}
                  </p>
                ) : null}
                <p>Network status unknown. Eligibility and deductibles were not checked.</p>
              </div>
            </div>
            {needsInsurance && !insuranceReady ? (
              <>
                <label className={styles.field}>
                  Insurance company
                  <input
                    className={styles.input}
                    onChange={(event) => {
                      setInsuranceDirty(true);
                      care.updateProfile({ insuranceCompany: event.target.value });
                    }}
                    value={care.profile.insuranceCompany}
                  />
                </label>
                <label className={styles.field}>
                  Member ID
                  <input
                    className={styles.input}
                    onChange={(event) => {
                      setInsuranceDirty(true);
                      care.updateProfile({ memberId: event.target.value });
                    }}
                    value={care.profile.memberId}
                  />
                </label>
                <label className={styles.field}>
                  Plan name
                  <input
                    className={styles.input}
                    onChange={(event) => {
                      setInsuranceDirty(true);
                      care.updateProfile({ planName: event.target.value });
                    }}
                    value={care.profile.planName}
                  />
                </label>
              </>
            ) : null}
          </section>

          <section className={styles.card}>
            <label className={styles.check}>
              <input
                checked={share}
                onChange={(event) => setShare(event.target.checked)}
                type="checkbox"
              />
              <span>
                I authorize Assurance to share these details with this office to request this appointment.
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
                Request SMS reminders (optional)
                <small>
                  {phoneReady
                    ? `No text is sent. A skipped reminder is recorded for ${care.profile.phone}.`
                    : "Add a phone number before requesting a reminder."}
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
          <p>Network status unknown.</p>
          <button className={styles.btnPrimaryWide} disabled={submitting || care.saving} onClick={confirm} type="button">
            {submitting || care.saving ? "Saving request…" : "Confirm and request booking"}
          </button>
          <p className={styles.fine}>This stores a simulated request. The office is not contacted, and the visit is not booked.</p>
        </aside>
      </div>

      <Link className={styles.backLink} href="/appointments/results">
        ← Back to results
      </Link>
    </div>
  );
}
