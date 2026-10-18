import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: "Chunggy",
    template: "%s · Chunggy",
  },
  description: "Find and book care with a little help.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html className={sans.className} lang="en">
      <body>{children}</body>
    </html>
  );
}
