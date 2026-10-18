import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { CareProvider } from "@/components/careway/provider";
import { AppShell } from "@/components/careway/shell";
import styles from "@/components/careway/careway.module.css";

export function Authed({
  children,
  withShell = false,
}: {
  children: ReactNode;
  withShell?: boolean;
}) {
  return (
    <Suspense
      fallback={
        <div className={styles.loadingPlain}>
          <p>Loading Chunggy…</p>
        </div>
      }
    >
      <AuthedGate withShell={withShell}>{children}</AuthedGate>
    </Suspense>
  );
}

async function AuthedGate({
  children,
  withShell,
}: {
  children: ReactNode;
  withShell: boolean;
}) {
  await connection();
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = {
    name: session.user.name || "Chunggy member",
    email: session.user.email || "",
    image: session.user.image ?? null,
  };

  return (
    <CareProvider user={user}>
      {withShell ? <AppShell>{children}</AppShell> : children}
    </CareProvider>
  );
}
