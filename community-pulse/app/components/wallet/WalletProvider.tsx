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
  isBurner: boolean;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>({ address: "", type: "burner", connected: false });
  const [account, setAccount] = useState<ReturnType<typeof makeAccount> | null>(null);

  useEffect(() => {
    // Always restore burner key from localStorage on mount.
    // If no key exists, create one and save it immediately.
    // The key persists until the user explicitly clears localStorage.
    let key = localStorage.getItem("cp_burner_key");
    try {
      let acc: ReturnType<typeof makeAccount>;
      if (key && key.startsWith("0x") && key.length > 10) {
        acc = makeAccount(key as `0x${string}`);
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

    // Also check if MetaMask was previously connected
    const savedMetaMask = localStorage.getItem("cp_metamask_address");
    if (savedMetaMask && (window as any).ethereum) {
      // Re-establish MetaMask silently
      (window as any).ethereum.request({ method: "eth_accounts" })
        .then((accounts: string[]) => {
          if (accounts[0] && accounts[0].toLowerCase() === savedMetaMask.toLowerCase()) {
            const acc = makeAccount();
            setAccount(acc);
            setWallet({ address: accounts[0], type: "metamask", connected: true });
          }
        })
        .catch(() => { /* MetaMask not available, stay on burner */ });
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
      const address = accounts[0];
      const acc = makeAccount();
      setAccount(acc);
      setWallet({ address, type: "metamask", connected: true });
      localStorage.setItem("cp_metamask_address", address);
    } catch (err: any) {
      if (err?.code === 4001) {
        alert("MetaMask connection rejected. Please approve the connection request.");
      } else {
        console.error("MetaMask connect failed:", err?.message);
      }
    }
  }, []);

  const connectBurner = useCallback(() => {
    const key = localStorage.getItem("cp_burner_key");
    try {
      const acc = key && key.startsWith("0x") && key.length > 10
        ? makeAccount(key as `0x${string}`)
        : makeAccount();
      localStorage.setItem("cp_burner_key", acc.privateKey);
      setAccount(acc);
      setWallet({ address: acc.address, type: "burner", connected: true });
      localStorage.removeItem("cp_metamask_address");
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
    <WalletContext.Provider value={{
      wallet, account, connectMetaMask, connectBurner, disconnect,
      isBurner: wallet.type === "burner",
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}