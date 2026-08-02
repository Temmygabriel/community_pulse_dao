import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/app/components/wallet/WalletProvider";
import { Header } from "@/app/components/ui/Header";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "CommunityPulse — On-chain treasury governed by AI",
  description: "Write a constitution. Pool funds. Let AI score every proposal against your values. Top proposals get funded automatically.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "CommunityPulse",
    description: "On-chain community treasury governed by AI. Pool funds. Write a constitution. Let the AI decide.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="bg-cream dark:bg-ink text-ink dark:text-cream antialiased min-h-screen" suppressHydrationWarning>
        <WalletProvider>
          <Header />
          <main className="max-w-2xl mx-auto px-4 pb-16 pt-6">
            {children}
          </main>
        </WalletProvider>
      </body>
    </html>
  );
}
