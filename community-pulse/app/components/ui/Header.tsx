"use client";
import Link from "next/link";
import { WalletButton } from "@/app/components/wallet/WalletButton";

export function Header() {
  return (
    <header className="sticky top-0 z-30 bg-cream/90 dark:bg-ink/90 backdrop-blur-sm border-b border-black/6 dark:border-white/8">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-lg bg-forest flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="4" fill="white" />
              <circle cx="12" cy="12" r="7.5" stroke="white" strokeWidth="1.5" strokeDasharray="2.5 2" strokeLinecap="round" />
              <circle cx="12" cy="3.5" r="1.5" fill="#74C69D" />
              <circle cx="19.5" cy="16.5" r="1.5" fill="#74C69D" />
              <circle cx="4.5" cy="16.5" r="1.5" fill="#74C69D" />
            </svg>
          </div>
          <span className="font-semibold text-ink dark:text-cream tracking-tight hidden sm:block">
            CommunityPulse
          </span>
        </Link>
        <WalletButton />
      </div>
    </header>
  );
}
