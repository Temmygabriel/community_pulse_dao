import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "CommunityPulse",
  description: "On-chain community treasury governed by AI. Pool funds. Propose. Let the constitution decide.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "CommunityPulse",
    description: "AI-enforced community treasury. One address, one voice. No whales.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}