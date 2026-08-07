"use client";
import Link from "next/link";
import { WalletButton } from "../wallet/WalletButton";

export function Header() {
  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 30,
      background: "rgba(250,250,248,0.9)", backdropFilter: "blur(8px)",
      borderBottom: "1px solid rgba(0,0,0,0.06)",
    }}>
      <div style={{
        maxWidth: 640, margin: "0 auto", padding: "0 1rem",
        height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: "#2D6A4F",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="4" fill="white" />
              <circle cx="12" cy="12" r="7.5" stroke="white" strokeWidth="1.5"
                strokeDasharray="2.5 2" strokeLinecap="round" />
              <circle cx="12" cy="3.5" r="1.5" fill="#74C69D" />
              <circle cx="19.5" cy="16.5" r="1.5" fill="#74C69D" />
              <circle cx="4.5" cy="16.5" r="1.5" fill="#74C69D" />
            </svg>
          </div>
          <span style={{ fontWeight: 600, color: "#1A1A18", letterSpacing: "-0.01em" }}>
            CommunityPulse
          </span>
        </Link>
        <WalletButton />
      </div>
    </header>
  );
}