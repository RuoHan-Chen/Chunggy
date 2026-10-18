import type { ReactNode } from "react";

import { Authed } from "@/components/careway/authed";

export const instant = false;

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <Authed>{children}</Authed>;
}
