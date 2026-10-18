"use client";

import { useState } from "react";

import { IconChevronDown, IconDoc } from "@/components/careway/icons";
import { useCare } from "@/components/careway/provider";
import {
  aboutErrors,
  formatDob,
  formatPhone,
  insuranceErrors,
  type PaymentChoice,
} from "@/lib/careway/model";
import styles from "@/components/careway/careway.module.css";

const tabs = ["Personal details", "Insurance", "Preferences", "Privacy"] as const;
type Tab = (typeof tabs)[number];

const terms = [
  {
    title: "Deductible",
    body: "The amount you pay for covered services before your insurance starts to pay.",
  },
  {
    title: "Copay",
    body: "A fixed amount you pay for a covered service, such as a doctor’s visit.",
  },
  {
    title: "Coinsurance",
    body: "Your share of the cost of a covered service, usually a percentage.",
  },
];

export function ProfileView({ initialTab = "Insurance" }: { initialTab?: Tab }) {
  const care = useCare();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState("");
  const [openTerm, setOpenTerm] = useState<string | null>("Deductible");
  const [showId, setShowId] = useState(false);
  const [permissionOpen, setPermissionOpen] = useState(false);
  const profile = care.profile;

  async function savePersonal() {
    const next = aboutErrors(profile);
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaved("Saving…");
    const result = await care.saveProfile();
    setSaved(result.message);
  }

  async function saveInsurance() {
    const next = profile.payment === "insurance" ? insuranceErrors(profile) : {};
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaved("Saving…");
    const result = await care.saveInsurance();
    setSaved(result.message);
  }

  const maskedId = profile.memberId
    ? showId
      ? profile.memberId
      : `•••• •••• ${profile.memberId.slice(-4)}`
    : "";

  return (
    <div className={styles.page}>
      <header className={styles.pageIntro}>
        <h1>Your profile & insurance</h1>
        <p>Keep your information up to date so we can help you book the right care.</p>
      </header>
      <div className={styles.tabs} role="tablist">
        {tabs.map((item) => (
          <button
            aria-selected={tab === item}
            className={tab === item ? styles.tabActive : styles.tab}
            key={item}
            onClick={() => {
              setTab(item);
              setSaved("");
              setErrors({});
            }}
            role="tab"
            type="button"
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "Personal details" ? (
        <section className={styles.cardNarrow}>
          <h2>Personal details</h2>
          <label className={styles.field}>
            Full name
            <input
              className={errors.fullName ? styles.inputError : styles.input}
              onChange={(event) => care.updateProfile({ fullName: event.target.value })}
              value={profile.fullName}
            />
            {errors.fullName ? <em>{errors.fullName}</em> : null}
          </label>
          <label className={styles.field}>
            Phone number
            <input
              className={errors.phone ? styles.inputError : styles.input}
              inputMode="tel"
              onChange={(event) =>
                care.updateProfile({ phone: formatPhone(event.target.value) })
              }
              placeholder="(312) 555-0142"
              value={profile.phone}
            />
            {errors.phone ? (
              <em>{errors.phone}</em>
            ) : (
              <span>Used for reminders and office updates.</span>
            )}
          </label>
          <div className={styles.fieldRow}>
            <label className={styles.field}>
              Date of birth
              <input
                className={errors.dateOfBirth ? styles.inputError : styles.input}
                onChange={(event) =>
                  care.updateProfile({ dateOfBirth: formatDob(event.target.value) })
                }
                placeholder="MM / DD / YYYY"
                value={profile.dateOfBirth}
              />
              {errors.dateOfBirth ? <em>{errors.dateOfBirth}</em> : null}
            </label>
            <label className={styles.field}>
              ZIP code
              <input
                className={errors.zip ? styles.inputError : styles.input}
                inputMode="numeric"
                maxLength={5}
                onChange={(event) =>
                  care.updateProfile({
                    zip: event.target.value.replace(/\D/g, "").slice(0, 5),
                  })
                }
                value={profile.zip}
              />
              {errors.zip ? <em>{errors.zip}</em> : null}
            </label>
          </div>
          <label className={styles.field}>
            Street address
            <input
              autoComplete="street-address"
              className={styles.input}
              onChange={(event) => care.updateProfile({ addressLine1: event.target.value })}
              value={profile.addressLine1}
            />
          </label>
          <div className={styles.fieldRow}>
            <label className={styles.field}>
              City
              <input
                autoComplete="address-level2"
                className={styles.input}
                onChange={(event) => care.updateProfile({ city: event.target.value })}
                value={profile.city}
              />
            </label>
            <label className={styles.field}>
              State
              <input
                autoComplete="address-level1"
                className={styles.input}
                maxLength={2}
                onChange={(event) => care.updateProfile({ region: event.target.value.toUpperCase() })}
                value={profile.region}
              />
            </label>
          </div>
          <label className={styles.field}>
            Preferred language
            <select
              className={styles.input}
              onChange={(event) => care.updateProfile({ language: event.target.value })}
              value={profile.language}
            >
              <option>English</option>
              <option>Spanish</option>
            </select>
          </label>
          <label className={styles.field}>
            Email
            <input className={styles.input} readOnly value={care.user.email} />
            <span>From your Google account.</span>
          </label>
          <div className={styles.actions}>
            <button className={styles.btnPrimary} disabled={care.saving} onClick={savePersonal} type="button">
              {care.saving ? "Saving…" : "Save details"}
            </button>
          </div>
          {saved ? <p className={styles.saved}>{saved}</p> : null}
        </section>
      ) : null}

      {tab === "Insurance" ? (
        <div className={styles.profileGrid}>
          <div className={styles.stack}>
            <section className={styles.card}>
              <h2>How would you like to pay?</h2>
              {(
                [
                  ["insurance", "Use insurance", "We’ll bill your insurance for covered services."],
                  ["self", "Self-pay", "You’ll pay for your visit out of pocket."],
                  ["later", "Decide later", "You can choose a payment method when booking."],
                ] as const
              ).map(([value, title, text]) => (
                <label className={styles.choice} key={value}>
                  <input
                    checked={profile.payment === value}
                    name="pay"
                    onChange={() => care.updateProfile({ payment: value as PaymentChoice })}
                    type="radio"
                  />
                  <span>
                    <strong>{title}</strong>
                    {text}
                  </span>
                </label>
              ))}
            </section>

            <section className={styles.card}>
              <h2>Upload your insurance card (optional)</h2>
              <p className={styles.cardLede}>
                Upload is a visual preview in this phase. Enter the insurance details below manually; card files are not stored.
              </p>
              <div className={styles.fieldRow}>
                <Upload
                  label="Front of card"
                  name={profile.cardFrontName}
                  onPick={(name) => care.updateProfile({ cardFrontName: name })}
                />
                <Upload
                  label="Back of card"
                  name={profile.cardBackName}
                  onPick={(name) => care.updateProfile({ cardBackName: name })}
                />
              </div>
              <div className={styles.cardHead}>
                <h3>
                  Insurance details <span className={styles.info}>i</span>
                </h3>
                <span>Enter these manually from your card.</span>
              </div>
              <label className={styles.field}>
                Insurance company
                <input
                  className={errors.insuranceCompany ? styles.inputError : styles.input}
                  onChange={(event) =>
                    care.updateProfile({ insuranceCompany: event.target.value })
                  }
                  value={profile.insuranceCompany}
                />
                {errors.insuranceCompany ? <em>{errors.insuranceCompany}</em> : null}
              </label>
              <label className={styles.field}>
                Member ID
                <span className={styles.inputIcon}>
                  <input
                    className={errors.memberId ? styles.inputError : styles.input}
                    onChange={(event) => care.updateProfile({ memberId: event.target.value })}
                    readOnly={!showId && Boolean(profile.memberId)}
                    value={maskedId}
                  />
                  <button onClick={() => setShowId((current) => !current)} type="button">
                    {showId ? "Hide" : "Show"}
                  </button>
                </span>
                {errors.memberId ? <em>{errors.memberId}</em> : null}
              </label>
              <label className={styles.field}>
                Plan name
                <input
                  className={errors.planName ? styles.inputError : styles.input}
                  onChange={(event) => care.updateProfile({ planName: event.target.value })}
                  value={profile.planName}
                />
                {errors.planName ? <em>{errors.planName}</em> : null}
              </label>
              <div className={styles.actions}>
                <button className={styles.btnPrimary} disabled={care.saving} onClick={saveInsurance} type="button">
                  {care.saving ? "Saving…" : "Save payment & insurance"}
                </button>
                <button
                  className={styles.textDanger}
                  onClick={async () => {
                    setSaved("Removing…");
                    const result = await care.clearInsurance();
                    setSaved(result.message);
                  }}
                  type="button"
                >
                  Remove insurance card
                </button>
              </div>
              {saved ? <p className={styles.saved}>{saved}</p> : null}
            </section>
          </div>

          <div className={styles.stack}>
            <section className={styles.card}>
              <h2>Coverage status</h2>
              <span
                className={
                  profile.coverageStatus === "requested" ? styles.badge : styles.badgeWarn
                }
              >
                {profile.coverageStatus === "requested" ? "Check requested" : "Not verified"}
              </span>
              <p className={styles.cardLede}>
                Adding a card doesn’t confirm coverage. We’ll need to check your plan details with your insurer.
              </p>
              <button
                className={styles.btnPrimaryWide}
                onClick={() => setPermissionOpen(true)}
                type="button"
              >
                Request coverage check
              </button>
              <p className={styles.fine}>Review permission before we contact your insurer.</p>
            </section>
            <section className={styles.card}>
              <h2>Common cost terms</h2>
              <p className={styles.cardLede}>These terms can help you understand your out-of-pocket costs.</p>
              {terms.map((term) => {
                const open = openTerm === term.title;
                return (
                  <button
                    className={styles.term}
                    key={term.title}
                    onClick={() => setOpenTerm(open ? null : term.title)}
                    type="button"
                  >
                    <span>
                      <strong>{term.title}</strong>
                      {open ? <small>{term.body}</small> : null}
                    </span>
                    <IconChevronDown />
                  </button>
                );
              })}
            </section>
          </div>
        </div>
      ) : null}

      {tab === "Preferences" ? (
        <section className={styles.cardNarrow}>
          <h2>Booking preferences</h2>
          <label className={styles.field}>
            Visit type
            <input className={styles.input} readOnly value={care.preferences.visitType} />
          </label>
          <label className={styles.field}>
            Location
            <input className={styles.input} readOnly value={care.preferences.location} />
          </label>
          <label className={styles.field}>
            Preferred times
            <select
              className={styles.input}
              onChange={(event) =>
                care.updatePreferences({ preferredTimes: event.target.value })
              }
              value={care.preferences.preferredTimes}
            >
              <option>Weekday mornings</option>
              <option>Weekday afternoons</option>
              <option>Flexible</option>
            </select>
          </label>
          <p className={styles.cardLede}>
            Change visit type and ZIP from the assistant. Payment is on the Insurance tab.
          </p>
        </section>
      ) : null}

      {tab === "Privacy" ? (
        <section className={styles.cardNarrow}>
          <h2>Privacy</h2>
          <p className={styles.cardLede}>
            {care.dataMode === "database"
              ? "Chunggy stores your profile and manually entered insurance details in Oracle. Google handles sign-in, and a visit request still needs your permission on the review screen."
              : "Oracle is disconnected, so this development session uses temporary example data. Your changes disappear when the page reloads."}
          </p>
          <ul className={styles.plainList}>
            <li>Phone number is used for reminders you opt into.</li>
            <li>Insurance details are not treated as verified coverage.</li>
            <li>Sign out any time from your name in the sidebar.</li>
          </ul>
        </section>
      ) : null}

      {permissionOpen ? (
        <div className={styles.modal} role="presentation">
          <div aria-modal="true" className={styles.modalCard} role="dialog">
            <h2>Request a coverage check?</h2>
            <p className={styles.cardLede}>
              A real check would share your name, date of birth, phone, and member ID with the insurer. This preview
              only marks the request on your profile.
            </p>
            <div className={styles.actions}>
              <button className={styles.btnOutline} onClick={() => setPermissionOpen(false)} type="button">
                Not now
              </button>
              <button
                className={styles.btnPrimary}
                onClick={() => {
                  care.requestCoverage();
                  setPermissionOpen(false);
                }}
                type="button"
              >
                Request check
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Upload({
  label,
  name,
  onPick,
}: {
  label: string;
  name: string;
  onPick: (name: string) => void;
}) {
  return (
    <label className={styles.upload}>
      <span className={styles.iconBubble}>
        <IconDoc />
      </span>
      <strong>{label}</strong>
      <em>{name || "Upload image"}</em>
      <span>JPG, PNG or PDF (max 10 MB)</span>
      <input
        accept="image/jpeg,image/png,application/pdf"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onPick(file.name);
        }}
        type="file"
      />
    </label>
  );
}
