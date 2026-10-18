"use client";

import { useState } from "react";

import styles from "@/components/careway/careway.module.css";

const faqs = [
  {
    q: "Does Chunggy call the office for me?",
    a: "Only after you review the visit and allow sharing. This preview keeps that choice on the review screen and does not place a call.",
  },
  {
    q: "Why do you ask for a phone number?",
    a: "Offices use it for reminders, forms, and schedule changes. You can turn SMS reminders off when you request a visit.",
  },
  {
    q: "Is the price on a visit final?",
    a: "No. Ranges are typical self-pay estimates. The office confirms the final cost, especially if more services are added.",
  },
  {
    q: "Does uploading an insurance card verify coverage?",
    a: "No. A card helps collect the company, member ID, and plan name. Coverage stays unverified until you request a check.",
  },
];

export function HelpView() {
  const [open, setOpen] = useState(0);

  return (
    <div className={styles.page}>
      <header className={styles.pageIntro}>
        <h1>Help</h1>
        <p>Short answers about booking, cost, and what gets shared.</p>
      </header>
      <section className={styles.cardNarrow}>
        {faqs.map((item, index) => (
          <button
            className={styles.term}
            key={item.q}
            onClick={() => setOpen(open === index ? -1 : index)}
            type="button"
          >
            <span>
              <strong>{item.q}</strong>
              {open === index ? <small>{item.a}</small> : null}
            </span>
          </button>
        ))}
      </section>
    </div>
  );
}
