"use client";

import { useState } from "react";

import { IconChevronDown, IconDoc } from "@/components/careway/icons";
import { useCare } from "@/components/careway/provider";
import {
  aboutErrors,
  visitTypeLabel,
  formatDob,
  formatPhone,
  insuranceErrors,
  type PaymentChoice,
} from "@/lib/careway/model";
import styles from "@/components/careway/careway.module.css";

const tabs = ["Personal details", "Insurance", "Preferences", "Privacy"] as const;
type Tab = (typeof tabs)[number];

type VapiTestResult = {
  callId: string;
  status: string;
  structuredOutputStatus: "available" | "pending" | "missing" | "invalid";
  structuredOutput: unknown | null;
  findingsStatus: "available" | "pending" | "missing" | "invalid";
  diagnostic: string | null;
  findings: {
    coverage_status: "covered" | "not_covered" | "unknown";
    coverage_percent: number | null;
    copay: number | null;
    deductible_remaining: number | null;
    prior_authorization_required: boolean | null;
    in_network_required: boolean | null;
    unresolved_questions: string[];
    call_summary: string;
  } | null;
};

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
  const [vapiLoading, setVapiLoading] = useState(false);
  const [vapiError, setVapiError] = useState("");
  const [vapiResult, setVapiResult] = useState<VapiTestResult | null>(null);
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

  async function fetchCoverageResult() {
    setVapiLoading(true);
    setVapiError("");
    setVapiResult(null);
    try {
      const response = await fetch("/api/vapi/test", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(typeof result.error === "string" ? result.error : "Could not retrieve the Vapi test call.");
      }
      setVapiResult(result as VapiTestResult);
    } catch (error) {
      setVapiError(error instanceof Error ? error.message : "Could not retrieve the Vapi test call.");
    } finally {
      setVapiLoading(false);
    }
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
                Adding a card doesn’t confirm coverage. Retrieve the configured completed Vapi test call to inspect its reported findings.
              </p>
              <button
                className={styles.btnPrimaryWide}
                onClick={() => setPermissionOpen(true)}
                type="button"
              >
                Request coverage check
              </button>
              <p className={styles.fine}>This demo fetches the synthetic test call; it does not send your profile details or contact your insurer.</p>
              {vapiLoading ? <p className={styles.saved} role="status">Retrieving call results…</p> : null}
              {vapiError ? <p className={styles.formError} role="alert">{vapiError}</p> : null}
              {vapiResult ? (
                <ul aria-live="polite" className={styles.plainList}>
                  <li><strong>Call status:</strong> {vapiResult.status}</li>
                  <li><strong>Structured output:</strong> {vapiResult.structuredOutputStatus}</li>
                  {vapiResult.findings ? (
                    <>
                      <li><strong>Coverage:</strong> {vapiResult.findings.coverage_status}</li>
                      <li><strong>Coverage percent:</strong> {vapiResult.findings.coverage_percent ?? "Not available"}</li>
                      <li><strong>Copay:</strong> {vapiResult.findings.copay === null ? "Not available" : `$${vapiResult.findings.copay}`}</li>
                      <li><strong>Deductible remaining:</strong> {vapiResult.findings.deductible_remaining === null ? "Not available" : `$${vapiResult.findings.deductible_remaining}`}</li>
                      <li><strong>Prior authorization:</strong> {vapiResult.findings.prior_authorization_required === null ? "Not available" : vapiResult.findings.prior_authorization_required ? "Required" : "Not required"}</li>
                      <li><strong>In network required:</strong> {vapiResult.findings.in_network_required === null ? "Not available" : vapiResult.findings.in_network_required ? "Yes" : "No"}</li>
                      <li><strong>Summary:</strong> {vapiResult.findings.call_summary}</li>
                      <li><strong>Unresolved questions:</strong> {vapiResult.findings.unresolved_questions.length ? vapiResult.findings.unresolved_questions.join("; ") : "None reported"}</li>
                      <li>Reported information from the call; verify benefits with the insurer.</li>
                    </>
                  ) : null}
                  {vapiResult.structuredOutput !== null && !vapiResult.findings ? (
                    <li>
                      <strong>Retrieved output data:</strong>
                      <pre className={styles.vapiOutput}>{JSON.stringify(vapiResult.structuredOutput, null, 2)}</pre>
                    </li>
                  ) : null}
                  {vapiResult.diagnostic ? <li>{vapiResult.diagnostic}</li> : null}
                </ul>
              ) : null}
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
            <input className={styles.input} readOnly value={visitTypeLabel(care.preferences.visitType)} />
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
              ? "Assurance stores your profile and manually entered insurance details in Oracle. Google handles sign-in, and a visit request still needs your permission on the review screen."
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
              This retrieves the configured synthetic Vapi test call only. It does not share your profile details or contact your insurer.
            </p>
            <div className={styles.actions}>
              <button className={styles.btnOutline} onClick={() => setPermissionOpen(false)} type="button">
                Not now
              </button>
              <button
                className={styles.btnPrimary}
                disabled={vapiLoading}
                onClick={async () => {
                  setPermissionOpen(false);
                  await fetchCoverageResult();
                }}
                type="button"
              >
                {vapiLoading ? "Retrieving…" : "Retrieve test results"}
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
