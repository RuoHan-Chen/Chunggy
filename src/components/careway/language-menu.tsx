"use client";

import { useEffect, useRef, useState } from "react";

import { languages } from "@/lib/careway/model";
import { IconChevronDown, IconGlobe } from "@/components/careway/icons";
import styles from "@/components/careway/careway.module.css";

export function LanguageMenu({
  value = "English",
  onChange,
}: {
  value?: string;
  onChange?: (language: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = value;

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, []);

  return (
    <div className={styles.language} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className={styles.languageButton}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <IconGlobe />
        {selected}
        <IconChevronDown />
      </button>
      {open ? (
        <ul className={styles.languageList} role="listbox">
          {languages.map((language) => (
            <li key={language}>
              <button
                aria-selected={language === selected}
                onClick={() => {
                  onChange?.(language);
                  setOpen(false);
                }}
                role="option"
                type="button"
              >
                {language}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
