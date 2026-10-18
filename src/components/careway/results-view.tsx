"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { IconPin, IconTooth } from "@/components/careway/icons";
import { useCare } from "@/components/careway/provider";
import { visitTypeLabel, type Slot } from "@/lib/careway/model";
import styles from "@/components/careway/careway.module.css";

export function ResultsView() {
  const care = useCare();
  const router = useRouter();
  const saved = care.savedCareRequest;
  const slots = saved
    ? saved.options
    : care.providerSlots.filter((slot) => slot.visitType === care.preferences.visitType);
  const summary = saved
    ? `${visitTypeLabel(saved.visitType)} · Near ${saved.postalCode ?? "your ZIP"} within ${saved.radiusMiles} miles · ${saved.timePreference ?? "any time"}`
    : `${visitTypeLabel(care.preferences.visitType)} · ${care.preferences.location} · ${care.preferences.preferredTimes}`;

  function choose(slot: Slot) {
    care.selectSlot(slot);
    router.push("/appointments/review");
  }

  return (
    <div className={styles.page}>
      <p className={styles.crumb}>
        <Link href="/assistant">Assistant</Link>
        <span>›</span>
        Results
      </p>
      <header className={styles.pageIntro}>
        <h1>Choose a time</h1>
        <p>{summary}</p>
        <p>{saved ? "Saved shortlist from Oracle." : "These options are not saved yet."}</p>
      </header>
      <div className={styles.stackWide}>
        {slots.length === 0 ? (
          <section className={styles.card}>
            <h2>No provider listings yet</h2>
            <p>No providers matched {visitTypeLabel(saved?.visitType ?? care.preferences.visitType)} with the current filters.</p>
          </section>
        ) : null}
        {slots.map((slot) => {
          const timePreference = saved?.timePreference ?? care.preferences.preferredTimes;
          const matches =
            timePreference === "Flexible" ||
            (timePreference === "Weekday mornings" && slot.period === "morning") ||
            (timePreference === "Weekday afternoons" && slot.period === "afternoon");
          return (
            <article className={styles.resultCard} key={slot.id}>
              <div className={styles.resultMain}>
                <span className={styles.iconBubble}>
                  <IconTooth />
                </span>
                <div>
                  <h2>{slot.provider}</h2>
                  <p>{visitTypeLabel(slot.visitType)}</p>
                  <p>
                    <IconPin /> {slot.address}, {slot.cityLine}
                  </p>
                </div>
                <div className={styles.resultMeta}>
                  <strong>{slot.distance}</strong>
                  <span>{slot.rating} patient rating</span>
                  {matches ? <em>Matches your time</em> : null}
                </div>
              </div>
              <div className={styles.slotRow}>
                <div>
                  <strong>{slot.dateLabel}</strong>
                  <span>
                    {slot.timeLabel} – {slot.endLabel} ({slot.duration})
                  </span>
                  <span>Estimated {slot.estimate}</span>
                </div>
                <button className={styles.btnPrimary} onClick={() => choose(slot)} type="button">
                  Review this time
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
