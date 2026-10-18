"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { signOutUser } from "@/app/auth-actions";
import {
  IconBell,
  IconCalendar,
  IconChat,
  IconChevron,
  IconHelp,
  IconHome,
  IconUser,
} from "@/components/careway/icons";
import { LanguageMenu } from "@/components/careway/language-menu";
import { useCare } from "@/components/careway/provider";
import { initials } from "@/lib/careway/model";
import styles from "@/components/careway/careway.module.css";

const links = [
  { href: "/home", label: "Home", icon: IconHome },
  { href: "/assistant", label: "Assistant", icon: IconChat },
  { href: "/appointments", label: "Appointments", icon: IconCalendar },
  { href: "/profile", label: "Profile & insurance", icon: IconUser },
];

function isActive(pathname: string, href: string) {
  if (href === "/home") return pathname === "/home";
  if (href === "/appointments") return pathname.startsWith("/appointments");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const care = useCare();
  const [menuOpen, setMenuOpen] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const displayName = care.profile.fullName || care.user.name || "Chunggy member";
  const unread = care.notices.some((notice) => !notice.read);

  useEffect(() => {
    if (!care.ready) return;
    if (!care.profile.onboardingComplete && !care.profile.deferred) {
      router.replace("/onboarding");
    }
  }, [care.profile.deferred, care.profile.onboardingComplete, care.ready, router]);

  if (!care.ready) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSidebar} />
        <div className={styles.loadingMain}>
          <p>Loading Chunggy…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/home">
          Chunggy
        </Link>
        <nav className={styles.nav} aria-label="Primary">
          {links.map((link) => {
            const Icon = link.icon;
            const active = isActive(pathname, link.href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={active ? styles.navLinkActive : styles.navLink}
                href={link.href}
                key={link.href}
              >
                <Icon />
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className={styles.sidebarFooter}>
          <Link
            className={pathname === "/help" ? styles.navLinkActive : styles.navLink}
            href="/help"
          >
            <IconHelp />
            Help
          </Link>
          <div className={styles.userWrap}>
            <button
              aria-expanded={menuOpen}
              className={styles.userButton}
              onClick={() => setMenuOpen((open) => !open)}
              type="button"
            >
              {care.user.image ? (
                // Google profile photos are remote and used only as the account avatar.
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className={styles.avatarImg} src={care.user.image} />
              ) : (
                <span className={styles.avatar}>{initials(displayName)}</span>
              )}
              <span className={styles.userMeta}>
                <strong>{displayName}</strong>
              </span>
              <IconChevron />
            </button>
            {menuOpen ? (
              <div className={styles.userMenu}>
                <p>{care.user.email}</p>
                <form action={signOutUser}>
                  <button type="submit">Sign out</button>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      </aside>
      <div className={styles.main}>
        <div className={styles.topbar}>
          <LanguageMenu
            onChange={(language) => care.updateProfile({ language })}
            value={care.profile.language || "English"}
          />
          <div className={styles.noticeWrap}>
            <button
              aria-expanded={noticesOpen}
              aria-label="Notifications"
              className={styles.bellButton}
              onClick={() => {
                setNoticesOpen((open) => !open);
                care.markNoticesRead();
              }}
              type="button"
            >
              <IconBell />
              {unread ? <span className={styles.bellDot} /> : null}
            </button>
            {noticesOpen ? (
              <div className={styles.noticePanel}>
                <strong>Updates</strong>
                <ul>
                  {care.notices.map((notice) => (
                    <li key={notice.id}>
                      <p>{notice.title}</p>
                      <span>{notice.body}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
        <div className={`${styles.content} ${pathname === "/assistant" ? styles.contentWide : ""}`}>
          {children}
        </div>
      </div>
    </div>
  );
}
