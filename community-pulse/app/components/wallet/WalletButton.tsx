"use client";
import { useState } from "react";
import { useWallet } from "./WalletProvider";

function truncate(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletButton() {
  const { wallet, connectBurner } = useWallet();
  const [open, setOpen] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [addrCopied, setAddrCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  if (!wallet.connected) {
    return (
      <button
        onClick={connectBurner}
        style={{ fontSize: 13, padding: "6px 14px", borderRadius: 999, border: "1px solid rgba(45,106,79,0.3)", color: "#2D6A4F", background: "rgba(216,243,220,0.4)", cursor: "pointer", fontFamily: "inherit" }}
      >
        Connect
      </button>
    );
  }

  function copyAddress() {
    navigator.clipboard.writeText(wallet.address);
    setAddrCopied(true);
    setTimeout(() => setAddrCopied(false), 2000);
  }

  function copyKey() {
    const key = localStorage.getItem("cp_burner_key") || "";
    navigator.clipboard.writeText(key);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  }

  const savedKey = typeof window !== "undefined" ? localStorage.getItem("cp_burner_key") || "" : "";

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "6px 14px", borderRadius: 999, border: "1px solid rgba(45,106,79,0.3)", background: "rgba(216,243,220,0.3)", cursor: "pointer", fontFamily: "inherit" }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#74C69D", flexShrink: 0 }} />
        <span style={{ color: "#2D6A4F", fontWeight: 500 }}>Burner</span>
        <span style={{ fontFamily: "monospace", color: "#5F6B5A", fontSize: 12 }}>{truncate(wallet.address)}</span>
      </button>

      {open && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 40 }}
            onClick={() => { setOpen(false); setShowKey(false); }}
          />
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 8px)",
            width: 300, background: "white", border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: 14, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 50, overflow: "hidden"
          }}>
            {/* Address section */}
            <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 11, color: "#8A9985", marginBottom: 4 }}>Burner wallet address</div>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "#1A1A18", wordBreak: "break-all", marginBottom: 8 }}>
                {wallet.address}
              </div>
              <button onClick={copyAddress} style={{ fontSize: 12, color: addrCopied ? "#2D6A4F" : "#5F6B5A", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8, padding: "4px 10px", background: "none", cursor: "pointer", fontFamily: "inherit" }}>
                {addrCopied ? "✓ Copied!" : "Copy address"}
              </button>
            </div>

            {/* Private key warning */}
            <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.06)", background: "rgba(244,162,97,0.06)" }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: "#F4A261", marginBottom: 6 }}>
                ⚠️ Save your private key
              </div>
              <div style={{ fontSize: 12, color: "#5F6B5A", lineHeight: 1.5, marginBottom: 10 }}>
                This key is stored in your browser. If you clear your browser data or use a different device, you will lose access to your communities and proposals. Save it now.
              </div>
              {!showKey ? (
                <button onClick={() => setShowKey(true)} style={{ fontSize: 12, color: "#F4A261", border: "1px solid rgba(244,162,97,0.4)", borderRadius: 8, padding: "4px 10px", background: "rgba(244,162,97,0.06)", cursor: "pointer", fontFamily: "inherit" }}>
                  Show private key
                </button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontFamily: "monospace", fontSize: 10, color: "#1A1A18", wordBreak: "break-all", background: "rgba(0,0,0,0.03)", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(0,0,0,0.08)" }}>
                    {savedKey}
                  </div>
                  <button onClick={copyKey} style={{ fontSize: 12, color: keyCopied ? "#2D6A4F" : "#F4A261", border: `1px solid ${keyCopied ? "rgba(45,106,79,0.4)" : "rgba(244,162,97,0.4)"}`, borderRadius: 8, padding: "4px 10px", background: "none", cursor: "pointer", fontFamily: "inherit" }}>
                    {keyCopied ? "✓ Key copied!" : "Copy private key"}
                  </button>
                </div>
              )}
            </div>

            {/* How to restore */}
            <div style={{ padding: "12px 16px" }}>
              <div style={{ fontSize: 11, color: "#8A9985", lineHeight: 1.5 }}>
                To restore on another browser: open the wallet menu on that browser and paste your private key. Your communities and proposals are tied to your address.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}