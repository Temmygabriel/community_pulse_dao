"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const KEY = "cp_burner_key";

interface WalletContextValue {
  address: string;
  getAccount: () => any;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState("");

  useEffect(() => {
    // Poll for window.__cp_account set by Header.tsx
    // Header initializes wallet first, pages use it via this context
    const check = () => {
      const acc = (window as any).__cp_account;
      if (acc && acc.address) {
        setAddress(acc.address);
      }
    };

    check();
    const interval = setInterval(check, 100);
    setTimeout(() => clearInterval(interval), 5000);
    return () => clearInterval(interval);
  }, []);

  function getAccount() {
    return (window as any).__cp_account || null;
  }

  return (
    <WalletContext.Provider value={{ address, getAccount }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");

  return {
    wallet: {
      address: ctx.address,
      type: "burner" as const,
      connected: !!ctx.address,
    },
    account: ctx.getAccount(),
  };
}