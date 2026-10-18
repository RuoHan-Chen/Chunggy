"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import {
  IconCalendar,
  IconCheck,
  IconDoc,
  IconPin,
} from "@/components/careway/icons";
import { LanguageMenu } from "@/components/careway/language-menu";
import { useCare } from "@/components/careway/provider";
import {
  aboutErrors,
  bornLong,
  formatDob,
  formatPhone,
  insuranceErrors,
  paymentTitle,
  type PaymentChoice,
} from "@/lib/careway/model";
import styles from "@/components/careway/careway.module.css";

const steps = ["About you", "Coverage", "Review"];

export function Onboarding() {
  const router = useRouter();
  const care = useCare();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveMessage, setSaveMessage] = useState("");
  const profile = care.profile;

  if (!care.ready) {
    return (
      <div className={styles.loadingPlain}>
        <p>Loading Chunggy…</p>
      </div>
    );
  }

  function continueFromAbout() {
    const nextErrors = aboutErrors(profile);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setStep(1);
  }

  function continueFromCoverage() {
    if (profile.payment !== "insurance") {
      setErrors({});
      setStep(2);
      return;
    }
    const nextErrors = insuranceErrors(profile);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setStep(2);
  }

  async function saveLater() {
    setSaveMessage("Saving…");
    const result = await care.deferOnboarding();
    setSaveMessage(result.message);
    if (result.ok) router.push("/home");
  }

  async function finish() {
    const nextErrors = aboutErrors(profile);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      setStep(0);
      return;
    }
    setSaveMessage("Saving…");
    const result = await care.completeOnboarding();
    setSaveMessage(result.message);
    if (result.ok) router.push("/home");
  }

  return (
    <div className={styles.onboard}>
      <div className={styles.langFloat}>
        <LanguageMenu
          onChange={(language) => care.updateProfile({ language })}
          value={profile.language}
        />
      </div>
      <div className={styles.onboardInner}>
        <ol className={styles.stepper}>
          {steps.map((label, index) => {
            const state =
              index < step ? styles.stepDone : index === step ? styles.stepCurrent : "";
            return (
              <li className={state} key={label}>
                <span>{index < step ? <IconCheck size={16} /> : index + 1}</span>
                {label}
              </li>
            );
          })}
        </ol>

        {step === 0 ? (
          <>
            <header className={styles.pageIntro}>
              <h1>Let’s start with the basics</h1>
              <p>A few details help us find the right care and show you nearby appointments.</p>
            </header>
            <div className={styles.split}>
              <div className={styles.stack}>
                <section className={styles.card}>
                  <h2>Personal information</h2>
                  <label className={styles.field}>
                    Full name
                    <input
                      autoComplete="name"
                      className={errors.fullName ? styles.inputError : styles.input}
                      onChange={(event) =>
                        care.updateProfile({ fullName: event.target.value })
                      }
                      value={profile.fullName}
                    />
                    {errors.fullName ? <em>{errors.fullName}</em> : null}
                  </label>
                  <label className={styles.field}>
                    Phone number
                    <input
                      autoComplete="tel"
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
                      <span>For visit reminders and office updates.</span>
                    )}
                  </label>
                  <div className={styles.fieldRow}>
                    <label className={styles.field}>
                      Date of birth
                      <span className={styles.inputIcon}>
                        <input
                          autoComplete="bday"
                          className={errors.dateOfBirth ? styles.inputError : styles.input}
                          inputMode="numeric"
                          onChange={(event) =>
                            care.updateProfile({ dateOfBirth: formatDob(event.target.value) })
                          }
                          placeholder="MM / DD / YYYY"
                          value={profile.dateOfBirth}
                        />
                        <IconCalendar />
                      </span>
                      {errors.dateOfBirth ? <em>{errors.dateOfBirth}</em> : null}
                    </label>
                    <label className={styles.field}>
                      ZIP code
                      <input
                        autoComplete="postal-code"
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
                    Street address (optional)
                    <input
                      autoComplete="street-address"
                      className={styles.input}
                      onChange={(event) => care.updateProfile({ addressLine1: event.target.value })}
                      value={profile.addressLine1}
                    />
                  </label>
                  <div className={styles.fieldRow}>
                    <label className={styles.field}>
                      City (optional)
                      <input
                        autoComplete="address-level2"
                        className={styles.input}
                        onChange={(event) => care.updateProfile({ city: event.target.value })}
                        value={profile.city}
                      />
                    </label>
                    <label className={styles.field}>
                      State (optional)
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
                      onChange={(event) =>
                        care.updateProfile({ language: event.target.value })
                      }
                      value={profile.language}
                    >
                      <option>English</option>
                      <option>Spanish</option>
                    </select>
                    <span>We’ll ask for your full address when you book.</span>
                  </label>
                </section>

                <section className={styles.card}>
                  <h2>Coverage (optional)</h2>
                  <p className={styles.cardLede}>
                    Add your insurance now, or choose another option. You can always update this later.
                  </p>
                  <div className={styles.choiceRow}>
                    {(
                      [
                        ["insurance", "Use insurance"],
                        ["self", "Pay myself"],
                        ["later", "Decide later"],
                      ] as const
                    ).map(([value, label]) => (
                      <label className={styles.choiceInline} key={value}>
                        <input
                          checked={profile.payment === value}
                          name="payment"
                          onChange={() =>
                            care.updateProfile({ payment: value as PaymentChoice })
                          }
                          type="radio"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  {profile.payment === "insurance" ? (
                    <button
                      className={styles.dashed}
                      onClick={() => setStep(1)}
                      type="button"
                    >
                      <span className={styles.iconBubble}>
                        <IconDoc />
                      </span>
                      <span>
                        <strong>Add insurance card</strong>
                        You can do this later.
                      </span>
                    </button>
                  ) : null}
                </section>

                <div className={styles.actions}>
                  <button className={styles.btnPrimary} onClick={continueFromAbout} type="button">
                    Continue
                  </button>
                  <button className={styles.btnOutline} disabled={care.saving} onClick={saveLater} type="button">
                    Save and finish later
                  </button>
                  {saveMessage ? <p className={styles.saved}>{saveMessage}</p> : null}
                </div>
              </div>
              <aside className={styles.sideCard}>
                <h2>How this information helps</h2>
                <SideItem
                  icon={<IconPin />}
                  text="Your ZIP code helps us show available providers and times in your area."
                  title="Find nearby appointments"
                />
                <SideItem
                  icon={<IconDoc />}
                  text="Insurance details help us confirm what’s covered and show you estimated costs."
                  title="Check your coverage"
                />
                <SideItem
                  icon={<IconCalendar />}
                  text="With a few basics, including a phone number, we can find the best options for your needs."
                  title="A smoother booking experience"
                />
              </aside>
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <header className={styles.pageIntro}>
              <h1>
                {profile.payment === "insurance"
                  ? "Add your coverage"
                  : profile.payment === "self"
                    ? "You’ll pay for visits yourself"
                    : "You can choose payment later"}
              </h1>
              <p>
                {profile.payment === "insurance"
                  ? "These details stay in your profile until you ask us to share them with an office."
                  : "You can switch this anytime from Profile & insurance."}
              </p>
            </header>
            <div className={styles.split}>
              <div className={styles.stack}>
                <section className={styles.card}>
                  {profile.payment === "insurance" ? (
                    <>
                      <h2>Insurance card preview</h2>
                      <p className={styles.cardLede}>
                        Card files are not stored in this phase. Type the details below manually.
                      </p>
                      <div className={styles.fieldRow}>
                        <FileSlot
                          label="Front of card"
                          name={profile.cardFrontName}
                          onPick={(name) => care.updateProfile({ cardFrontName: name })}
                        />
                        <FileSlot
                          label="Back of card"
                          name={profile.cardBackName}
                          onPick={(name) => care.updateProfile({ cardBackName: name })}
                        />
                      </div>
                      <label className={styles.field}>
                        Insurance company
                        <input
                          className={errors.insuranceCompany ? styles.inputError : styles.input}
                          onChange={(event) =>
                            care.updateProfile({ insuranceCompany: event.target.value })
                          }
                          placeholder="Example Health"
                          value={profile.insuranceCompany}
                        />
                        {errors.insuranceCompany ? <em>{errors.insuranceCompany}</em> : null}
                      </label>
                      <label className={styles.field}>
                        Member ID
                        <input
                          className={errors.memberId ? styles.inputError : styles.input}
                          onChange={(event) =>
                            care.updateProfile({ memberId: event.target.value })
                          }
                          value={profile.memberId}
                        />
                        {errors.memberId ? <em>{errors.memberId}</em> : null}
                      </label>
                      <label className={styles.field}>
                        Plan name
                        <input
                          className={errors.planName ? styles.inputError : styles.input}
                          onChange={(event) =>
                            care.updateProfile({ planName: event.target.value })
                          }
                          placeholder="Example PPO"
                          value={profile.planName}
                        />
                        {errors.planName ? <em>{errors.planName}</em> : null}
                      </label>
                    </>
                  ) : (
                    <>
                      <h2>{paymentTitle(profile.payment)}</h2>
                      <p className={styles.cardLede}>
                        {profile.payment === "self"
                          ? "We’ll show typical self-pay ranges. The office confirms the final amount."
                          : "You can pick insurance or self-pay when you request a visit."}
                      </p>
                    </>
                  )}
                </section>
                <div className={styles.actions}>
                  <button className={styles.btnPrimary} onClick={continueFromCoverage} type="button">
                    Continue
                  </button>
                  <button className={styles.btnOutline} onClick={() => setStep(0)} type="button">
                    Back
                  </button>
                  {profile.payment === "insurance" ? (
                    <button
                      className={styles.btnGhost}
                      onClick={() => {
                        setErrors({});
                        setStep(2);
                      }}
                      type="button"
                    >
                      Add this later
                    </button>
                  ) : null}
                </div>
              </div>
              <aside className={styles.sideCard}>
                <h2>What happens next</h2>
                <SideItem
                  icon={<IconDoc />}
                  text="Adding a card doesn’t confirm coverage. A check is a separate step you approve."
                  title="Nothing is sent yet"
                />
                <SideItem
                  icon={<IconPin />}
                  text="Your phone number is how an office can reach you if a time changes."
                  title="Keep your number handy"
                />
              </aside>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <header className={styles.pageIntro}>
              <h1>Review your details</h1>
              <p>This is what Chunggy will use to find care. Offices only see it when you allow it.</p>
            </header>
            <div className={styles.split}>
              <div className={styles.stack}>
                <section className={styles.card}>
                  <h2>About you</h2>
                  <dl className={styles.summaryList}>
                    <div>
                      <dt>Name</dt>
                      <dd>{profile.fullName}</dd>
                    </div>
                    <div>
                      <dt>Phone</dt>
                      <dd>{profile.phone}</dd>
                    </div>
                    <div>
                      <dt>Date of birth</dt>
                      <dd>{bornLong(profile.dateOfBirth)}</dd>
                    </div>
                    <div>
                      <dt>ZIP code</dt>
                      <dd>{profile.zip}</dd>
                    </div>
                    <div>
                      <dt>Language</dt>
                      <dd>{profile.language}</dd>
                    </div>
                    <div>
                      <dt>Payment</dt>
                      <dd>{paymentTitle(profile.payment)}</dd>
                    </div>
                    {profile.payment === "insurance" && profile.insuranceCompany ? (
                      <div>
                        <dt>Insurance</dt>
                        <dd>
                          {profile.insuranceCompany}
                          {profile.planName ? ` · ${profile.planName}` : ""}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </section>
                <div className={styles.actions}>
                  <button className={styles.btnPrimary} disabled={care.saving} onClick={finish} type="button">
                    {care.saving ? "Saving…" : "Finish setup"}
                  </button>
                  <button className={styles.btnOutline} onClick={() => setStep(1)} type="button">
                    Back
                  </button>
                </div>
                {saveMessage ? <p className={styles.saved}>{saveMessage}</p> : null}
              </div>
              <aside className={styles.sideCard}>
                <h2>You stay in control</h2>
                <SideItem
                  icon={<IconCheck size={20} />}
                  text="Change your phone, ZIP, or coverage later from Profile & insurance."
                  title="Editable anytime"
                />
                <SideItem
                  icon={<IconDoc />}
                  text="Booking still asks before Chunggy shares your details with an office."
                  title="Sharing is a separate yes"
                />
              </aside>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function SideItem({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className={styles.sideItem}>
      <span className={styles.iconBubble}>{icon}</span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}

function FileSlot({
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
