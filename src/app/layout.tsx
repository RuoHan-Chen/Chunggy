import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chunggy",
  description: "Oracle, authentication, and OpenAI server foundation",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
