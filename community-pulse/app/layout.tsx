import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/app/components/wallet/WalletProvider";
import { Header } from "@/app/components/ui/Header";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "CommunityPulse — On-chain treasury governed by AI",
  description: "Write a constitution. Pool funds. Let AI score every proposal against your values. Top proposals get funded automatically.",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "CommunityPulse",
    description: "On-chain community treasury governed by AI. Pool funds. Write a constitution. Let the AI decide.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body suppressHydrationWarning>
        <WalletProvider>
          <Header />
          <main style={{ maxWidth: 640, margin: "0 auto", padding: "1.5rem 1rem 5rem" }}>
            {children}
          </main>
        </WalletProvider>
      </body>
    </html>
  );
}