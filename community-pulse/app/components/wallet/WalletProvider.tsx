"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { makeAccount } from "@/lib/contract";
import type { WalletState } from "@/lib/types";

interface WalletContextValue {
  wallet: WalletState;
  account: ReturnType<typeof makeAccount> | null;
  connectMetaMask: () => Promise<void>;
  connectBurner: () => void;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>({ address: "", type: "burner", connected: false });
  const [account, setAccount] = useState<ReturnType<typeof makeAccount> | null>(null);

  useEffect(() => {
    // ALWAYS restore the same burner key from localStorage.
    // Only generate a new one if absolutely nothing is saved.
    // This key is permanent for this browser — it never changes on refresh.
    const saved = localStorage.getItem("cp_burner_key");
    
    try {
      if (saved && saved.startsWith("0x") && saved.length >= 66) {
        // Valid saved key — restore it, same address every time
        const acc = makeAccount(saved as `0x${string}`);
        setAccount(acc);
        setWallet({ address: acc.address, type: "burner", connected: true });
      } else {
        // No key saved yet — generate once and persist forever
        const acc = makeAccount();
        localStorage.setItem("cp_burner_key", acc.privateKey);
        setAccount(acc);
        setWallet({ address: acc.address, type: "burner", connected: true });
      }
    } catch {
      // If restore fails for any reason, generate fresh and save
      const acc = makeAccount();
      localStorage.setItem("cp_burner_key", acc.privateKey);
      setAccount(acc);
      setWallet({ address: acc.address, type: "burner", connected: true });
    }
  }, []);

  const connectMetaMask = useCallback(async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      alert("MetaMask not detected. Please install MetaMask from metamask.io and refresh.");
      return;
    }
    try {
      const accounts: string[] = await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      });
      if (!accounts[0]) throw new Error("No account returned");
      // Note: MetaMask is display-only on studionet.
      // Transactions still sign with the burner key — genlayer-js
      // requires its own account object, not MetaMask's signer.
      // We show the MetaMask address so the user knows which account
      // they're "representing" but the burner key does the actual signing.
      const saved = localStorage.getItem("cp_burner_key");
      const acc = saved && saved.startsWith("0x") && saved.length >= 66
        ? makeAccount(saved as `0x${string}`)
        : makeAccount();
      setAccount(acc);
      setWallet({ address: accounts[0], type: "metamask", connected: true });
    } catch (err: any) {
      if (err?.code === 4001) {
        alert("MetaMask connection rejected.");
      } else {
        console.error("MetaMask connect failed:", err?.message);
      }
    }
  }, []);

  const connectBurner = useCallback(() => {
    // Always restore from saved key — never generate a new one
    const saved = localStorage.getItem("cp_burner_key");
    try {
      if (saved && saved.startsWith("0x") && saved.length >= 66) {
        const acc = makeAccount(saved as `0x${string}`);
        setAccount(acc);
        setWallet({ address: acc.address, type: "burner", connected: true });
      } else {
        const acc = makeAccount();
        localStorage.setItem("cp_burner_key", acc.privateKey);
        setAccount(acc);
        setWallet({ address: acc.address, type: "burner", connected: true });
      }
    } catch {
      const acc = makeAccount();
      localStorage.setItem("cp_burner_key", acc.privateKey);
      setAccount(acc);
      setWallet({ address: acc.address, type: "burner", connected: true });
    }
  }, []);

  const disconnect = useCallback(() => {
    setWallet({ address: "", type: "burner", connected: false });
    setAccount(null);
  }, []);

  return (
    <WalletContext.Provider value={{ wallet, account, connectMetaMask, connectBurner, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}