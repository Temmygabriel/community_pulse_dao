"use client";
import {
  createContext, useContext, useState,
  useEffect, useCallback, useRef, ReactNode
} from "react";

// ----------------------------------------------------------------
// KEY INSIGHT: Next.js App Router layout.tsx is a server component.
// Any provider rendered inside it gets server-rendered first, then
// hydrated on the client. During SSR, localStorage does not exist.
// During hydration, React reconciles server HTML with client state.
// If client state differs from server state, React re-renders —
// which is why a new key was being generated every refresh.
//
// THE FIX: Use a ref to store the account (like Hot Take Protocol),
// but critically — initialize state to null/empty and ONLY populate
// it inside useEffect. This means server renders nothing for wallet,
// client renders the real wallet. No mismatch, no re-render loop.
// suppressHydrationWarning on body handles the flash.
// ----------------------------------------------------------------

interface WalletState {
  address: string;
  type: "burner" | "metamask";
  connected: boolean;
}

// Lazy import to prevent ANY genlayer-js code running on server
type AccountType = { address: string; privateKey: string };

interface WalletContextValue {
  wallet: WalletState;
  account: AccountType | null;
  connectMetaMask: () => Promise<void>;
  connectBurner: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

const STORAGE_KEY = "cp_burner_key";

export function WalletProvider({ children }: { children: ReactNode }) {
  // Start with null — server renders null, client populates in useEffect
  const [wallet, setWallet] = useState<WalletState>({
    address: "", type: "burner", connected: false
  });
  const accountRef = useRef<AccountType | null>(null);
  const [account, setAccount] = useState<AccountType | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    // Guard against double-invocation in React 18 strict mode
    if (initialized.current) return;
    initialized.current = true;

    // localStorage is guaranteed here — we are on the client
    const savedKey = localStorage.getItem(STORAGE_KEY);

    // Dynamically import genlayer-js only on client
    import("@/lib/contract").then(({ makeAccount }) => {
      let acc: AccountType;

      if (savedKey && savedKey.startsWith("0x") && savedKey.length >= 66) {
        // Restore existing key — SAME address every time
        acc = makeAccount(savedKey as `0x${string}`);
      } else {
        // First visit — generate once, save permanently
        acc = makeAccount();
        localStorage.setItem(STORAGE_KEY, acc.privateKey);
      }

      accountRef.current = acc;
      setAccount(acc);
      setWallet({ address: acc.address, type: "burner", connected: true });
    });
  }, []); // Runs exactly once on client mount

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
      // Burner key still does the actual signing on studionet
      setWallet(prev => ({ ...prev, address: accounts[0], type: "metamask" }));
    } catch (err: any) {
      if (err?.code === 4001) alert("MetaMask connection rejected.");
    }
  }, []);

  const connectBurner = useCallback(() => {
    const savedKey = localStorage.getItem(STORAGE_KEY);
    import("@/lib/contract").then(({ makeAccount }) => {
      let acc: AccountType;
      if (savedKey && savedKey.startsWith("0x") && savedKey.length >= 66) {
        acc = makeAccount(savedKey as `0x${string}`);
      } else {
        acc = makeAccount();
        localStorage.setItem(STORAGE_KEY, acc.privateKey);
      }
      accountRef.current = acc;
      setAccount(acc);
      setWallet({ address: acc.address, type: "burner", connected: true });
    });
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