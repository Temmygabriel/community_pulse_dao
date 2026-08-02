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

  // Restore burner key on mount
  useEffect(() => {
    const savedKey = localStorage.getItem("cp_burner_key");
    try {
      let acc: ReturnType<typeof makeAccount>;
      if (savedKey && savedKey.startsWith("0x")) {
        acc = makeAccount(savedKey as `0x${string}`);
      } else {
        acc = makeAccount();
        localStorage.setItem("cp_burner_key", acc.privateKey);
      }
      setAccount(acc);
      setWallet({ address: acc.address, type: "burner", connected: true });
    } catch {
      const acc = makeAccount();
      localStorage.setItem("cp_burner_key", acc.privateKey);
      setAccount(acc);
      setWallet({ address: acc.address, type: "burner", connected: true });
    }
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
      const address = accounts[0];
      // For MetaMask, we create an account object with the address only —
      // signing is handled by MetaMask's injected provider.
      const acc = makeAccount();
      setAccount(acc);
      setWallet({ address, type: "metamask", connected: true });
      localStorage.setItem("cp_metamask_address", address);
    } catch (err: any) {
      console.error("MetaMask connect failed:", err?.message);
    }
  }, []);

  const connectBurner = useCallback(() => {
    const savedKey = localStorage.getItem("cp_burner_key");
    try {
      const acc = savedKey && savedKey.startsWith("0x")
        ? makeAccount(savedKey as `0x${string}`)
        : makeAccount();
      localStorage.setItem("cp_burner_key", acc.privateKey);
      setAccount(acc);
      setWallet({ address: acc.address, type: "burner", connected: true });
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
