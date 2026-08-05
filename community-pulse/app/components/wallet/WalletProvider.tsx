"use client";
import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { makeAccount } from "@/lib/contract";

// ----------------------------------------------------------------
// Pattern copied directly from Hot Take Protocol which solved this:
// - account stored in useRef (persists, no re-renders)
// - localStorage read inside useEffect with [] deps (runs once, client only)
// - synchronous makeAccount call, no async, no race condition
// ----------------------------------------------------------------

interface WalletState {
  address: string;
  type: "burner" | "metamask";
  connected: boolean;
}

interface WalletContextValue {
  wallet: WalletState;
  accountRef: React.MutableRefObject<ReturnType<typeof makeAccount> | null>;
  account: ReturnType<typeof makeAccount> | null;
  connectMetaMask: () => Promise<void>;
  connectBurner: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const KEY_NAME = "cp_burner_key";

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>({ address: "", type: "burner", connected: false });
  const accountRef = useRef<ReturnType<typeof makeAccount> | null>(null);
  const [account, setAccount] = useState<ReturnType<typeof makeAccount> | null>(null);

  useEffect(() => {
    // Runs ONCE on client mount — exact same pattern as Hot Take Protocol
    // localStorage is guaranteed available here
    const savedKey = localStorage.getItem(KEY_NAME);

    let acc: ReturnType<typeof makeAccount>;
    if (savedKey && savedKey.startsWith("0x") && savedKey.length >= 66) {
      // Restore existing key — same address every time
      acc = makeAccount(savedKey as `0x${string}`);
    } else {
      // First visit — generate once and save permanently
      acc = makeAccount();
      localStorage.setItem(KEY_NAME, acc.privateKey);
    }

    accountRef.current = acc;
    setAccount(acc);
    setWallet({ address: acc.address, type: "burner", connected: true });
  }, []); // Empty deps — runs exactly once

  const connectMetaMask = useCallback(async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      alert("MetaMask not detected. Please install MetaMask and refresh.");
      return;
    }
    try {
      const accounts: string[] = await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      });
      if (!accounts[0]) throw new Error("No account returned");
      // Keep same burner account for signing — MetaMask address is display only
      // genlayer-js on studionet requires its own account object for signing
      setWallet({ address: accounts[0], type: "metamask", connected: true });
    } catch (err: any) {
      if (err?.code === 4001) {
        alert("MetaMask connection rejected.");
      }
    }
  }, []);

  const connectBurner = useCallback(() => {
    const savedKey = localStorage.getItem(KEY_NAME);
    let acc: ReturnType<typeof makeAccount>;
    if (savedKey && savedKey.startsWith("0x") && savedKey.length >= 66) {
      acc = makeAccount(savedKey as `0x${string}`);
    } else {
      acc = makeAccount();
      localStorage.setItem(KEY_NAME, acc.privateKey);
    }
    accountRef.current = acc;
    setAccount(acc);
    setWallet({ address: acc.address, type: "burner", connected: true });
  }, []);

  return (
    <WalletContext.Provider value={{ wallet, accountRef, account, connectMetaMask, connectBurner }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}