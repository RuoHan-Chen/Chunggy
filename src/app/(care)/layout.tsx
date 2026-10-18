import type { ReactNode } from "react";

import { Authed } from "@/components/careway/authed";

export const instant = false;

export default function CareLayout({ children }: { children: ReactNode }) {
  return <Authed withShell>{children}</Authed>;
}
