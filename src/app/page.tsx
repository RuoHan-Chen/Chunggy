import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

export const instant = false;

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeGate />
    </Suspense>
  );
}

async function HomeGate() {
  await connection();
  const session = await auth();
  redirect(session?.user ? "/home" : "/login");
  return null;
}
