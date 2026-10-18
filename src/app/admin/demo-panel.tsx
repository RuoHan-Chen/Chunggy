"use client";

import Link from "next/link";
import { useCallback, useSyncExternalStore } from "react";

import { visitTypeLabel } from "@/lib/careway/model";
import {
  clearPreview,
  emptyPreview,
  eyeReadyPreview,
  readPreview,
  samplePreview,
  subscribePreview,
  writePreview,
} from "@/lib/careway/preview";

import styles from "./admin.module.css";

const routes = [
  ["/onboarding", "Onboarding"],
  ["/assistant", "Assistant"],
  ["/appointments/results", "Results"],
  ["/appointments/review", "Review"],
  ["/appointments/confirmed", "Confirmation"],
  ["/profile", "Profile"],
] as const;

export function DemoPanel({ email, name }: { email: string; name: string }) {
  const subscribe = useCallback(
    (onChange: () => void) => subscribePreview(email, onChange),
    [email],
  );
  const read = useCallback(() => readPreview(email), [email]);
  const preview = useSyncExternalStore(subscribe, read, emptyPreview);

  return (
    <section className={styles.section}>
      <h2>This browser</h2>
      <p className={styles.lede}>
        Reset and seed change only the Assurance preview stored in this browser. They do not write Oracle rows.
      </p>
      {preview ? (
        <ul className={styles.facts}>
          <li>Booking step: {preview.bookingStep}</li>
          <li>Visit: {visitTypeLabel(preview.preferences.visitType)}</li>
          <li>ZIP: {preview.profile.zip || "none"}</li>
          <li>Messages: {preview.messages.length}</li>
        </ul>
      ) : (
        <p className={styles.lede}>No local preview. Care screens are using the server snapshot.</p>
      )}
      <div className={styles.actions}>
        <button className={styles.button} onClick={() => writePreview(email, samplePreview(name))} type="button">
          Reset sample preview
        </button>
        <button className={`${styles.button} ${styles.primary}`} onClick={() => writePreview(email, eyeReadyPreview(name))} type="button">
          Seed ready eye visit
        </button>
        <button className={styles.button} onClick={() => clearPreview(email)} type="button">
          Use server data
        </button>
      </div>
      <div className={styles.links}>
        {routes.map(([href, label]) => (
          <Link className={styles.textLink} href={href} key={href}>
            {label}
          </Link>
        ))}
      </div>
    </section>
  );
}
