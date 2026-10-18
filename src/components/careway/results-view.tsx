"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { IconPin, IconTooth } from "@/components/careway/icons";
import { useCare } from "@/components/careway/provider";
import { slotsFor, type Slot } from "@/lib/careway/model";
import styles from "@/components/careway/careway.module.css";

export function ResultsView() {
  const care = useCare();
  const router = useRouter();
  const slots = slotsFor(care.preferences.visitType, care.preferences.preferredTimes);

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
        <p>
          {care.preferences.visitType} · {care.preferences.location} ·{" "}
          {care.preferences.preferredTimes}
        </p>
      </header>
      <div className={styles.stackWide}>
        {slots.map((slot) => {
          const matches =
            care.preferences.preferredTimes === "Flexible" ||
            (care.preferences.preferredTimes === "Weekday mornings" &&
              slot.period === "morning") ||
            (care.preferences.preferredTimes === "Weekday afternoons" &&
              slot.period === "afternoon");
          return (
            <article className={styles.resultCard} key={slot.id}>
              <div className={styles.resultMain}>
                <span className={styles.iconBubble}>
                  <IconTooth />
                </span>
                <div>
                  <h2>{slot.provider}</h2>
                  <p>{slot.visitType}</p>
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
