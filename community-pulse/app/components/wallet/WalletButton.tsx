"use client";
import { useState } from "react";
import { useWallet } from "./WalletProvider";
import { truncateAddress } from "@/lib/utils";

export function WalletButton() {
  const { wallet, connectMetaMask, connectBurner } = useWallet();
  const [open, setOpen] = useState(false);

  if (!wallet.connected) {
    return (
      <button
        onClick={connectBurner}
        className="text-sm px-3 py-1.5 rounded-full border border-forest/30 text-forest bg-mint/30 hover:bg-mint/50 transition-colors"
      >
        Connect
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-full border border-forest/30 bg-mint/20 hover:bg-mint/40 transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-sage" />
        <span className="text-forest font-medium hidden sm:block">
          {wallet.type === "metamask" ? "MetaMask" : "Burner"}
        </span>
        <span className="text-stone font-mono text-xs">
          {truncateAddress(wallet.address, 4)}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-ink rounded-xl border border-black/8 dark:border-white/10 shadow-lg z-50 overflow-hidden">
          <div className="p-3 border-b border-black/6 dark:border-white/8">
            <div className="text-xs text-stone dark:text-fog mb-1">
              {wallet.type === "metamask" ? "MetaMask wallet" : "Burner wallet"}
            </div>
            <div className="font-mono text-xs text-ink dark:text-cream break-all">
              {wallet.address}
            </div>
          </div>
          <div className="p-2 flex flex-col gap-1">
            {wallet.type === "burner" && (
              <button
                onClick={() => { connectMetaMask(); setOpen(false); }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-forest hover:bg-mint/20 transition-colors font-medium"
              >
                Connect MetaMask instead →
              </button>
            )}
            {wallet.type === "metamask" && (
              <button
                onClick={() => { connectBurner(); setOpen(false); }}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-stone dark:text-fog hover:bg-black/4 dark:hover:bg-white/6 transition-colors"
              >
                Switch to burner key
              </button>
            )}
            <button
              onClick={() => {
                navigator.clipboard.writeText(wallet.address);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 rounded-lg text-sm text-stone dark:text-fog hover:bg-black/4 dark:hover:bg-white/6 transition-colors"
            >
              Copy address
            </button>
          </div>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
    </div>
  );
}
