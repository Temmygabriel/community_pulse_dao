"use client";
import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";

const KEY = "cp_burner_key";

interface WalletState {
  address: string;
  type: "burner" | "metamask";
  connected: boolean;
}

interface WalletContextValue {
  wallet: WalletState;
  account: any;
  connectMetaMask: () => Promise<void>;
  connectBurner: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>({ address: "", type: "burner", connected: false });
  const accountRef = useRef<any>(null);
  const [account, setAccount] = useState<any>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const run = async () => {
      // Dynamic import — never runs on server
      const { makeAccount } = await import("@/lib/contract");
      const saved = localStorage.getItem(KEY);

      let acc: any;
      if (saved && saved.startsWith("0x") && saved.length >= 66) {
        acc = makeAccount(saved as `0x${string}`);
      } else {
        acc = makeAccount();
        // NOW acc.privateKey is real because makeAccount() attaches it explicitly
        localStorage.setItem(KEY, acc.privateKey);
      }

      accountRef.current = acc;
      setAccount(acc);
      setWallet({ address: acc.address, type: "burner", connected: true });
    };

    run();
  }, []);

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
      setWallet(prev => ({ ...prev, address: accounts[0], type: "metamask" }));
    } catch (err: any) {
      if (err?.code === 4001) alert("MetaMask connection rejected.");
    }
  }, []);

  const connectBurner = useCallback(async () => {
    const { makeAccount } = await import("@/lib/contract");
    const saved = localStorage.getItem(KEY);
    let acc: any;
    if (saved && saved.startsWith("0x") && saved.length >= 66) {
      acc = makeAccount(saved as `0x${string}`);
    } else {
      acc = makeAccount();
      localStorage.setItem(KEY, acc.privateKey);
    }
    accountRef.current = acc;
    setAccount(acc);
    setWallet({ address: acc.address, type: "burner", connected: true });
  }, []);

  return (
    <WalletContext.Provider value={{ wallet, account, connectMetaMask, connectBurner }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}