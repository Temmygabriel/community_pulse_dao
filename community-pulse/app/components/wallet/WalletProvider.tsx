"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

// Lazy import makeAccount only on client
async function getAccount(privateKey?: string) {
  const { makeAccount } = await import("@/lib/contract");
  return privateKey ? makeAccount(privateKey as `0x${string}`) : makeAccount();
}

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
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const STORAGE_KEY = "cp_burner_key_v2";

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>({ address: "", type: "burner", connected: false });
  const [account, setAccount] = useState<any>(null);

  useEffect(() => {
    // This runs ONLY on the client, after hydration.
    // localStorage is guaranteed to exist here.
    let key = localStorage.getItem(STORAGE_KEY);

    getAccount(key && key.startsWith("0x") && key.length >= 66 ? key : undefined)
      .then(acc => {
        // If we generated a new key, save it immediately
        if (!key || !key.startsWith("0x") || key.length < 66) {
          localStorage.setItem(STORAGE_KEY, acc.privateKey);
        }
        setAccount(acc);
        setWallet({ address: acc.address, type: "burner", connected: true });
      })
      .catch(() => {
        // Fallback — generate fresh
        getAccount().then(acc => {
          localStorage.setItem(STORAGE_KEY, acc.privateKey);
          setAccount(acc);
          setWallet({ address: acc.address, type: "burner", connected: true });
        });
      });
  }, []); // Empty deps — runs once on mount, never again

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
      // Keep the same burner account for actual signing
      // MetaMask address is just for display
      const key = localStorage.getItem(STORAGE_KEY);
      const acc = await getAccount(key && key.startsWith("0x") && key.length >= 66 ? key : undefined);
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
    const key = localStorage.getItem(STORAGE_KEY);
    getAccount(key && key.startsWith("0x") && key.length >= 66 ? key : undefined)
      .then(acc => {
        if (!key || !key.startsWith("0x") || key.length < 66) {
          localStorage.setItem(STORAGE_KEY, acc.privateKey);
        }
        setAccount(acc);
        setWallet({ address: acc.address, type: "burner", connected: true });
      });
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