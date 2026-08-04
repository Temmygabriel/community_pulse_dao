"use client";
import { useState } from "react";
import { useWallet } from "./WalletProvider";

function truncate(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletButton() {
  const { wallet, connectMetaMask, connectBurner } = useWallet();
  const [open, setOpen] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [addrCopied, setAddrCopied] = useState(false);
  const [privateKey, setPrivateKey] = useState("");

  if (!wallet.connected || !wallet.address) return null;

  function copyAddress() {
    navigator.clipboard.writeText(wallet.address);
    setAddrCopied(true);
    setTimeout(() => setAddrCopied(false), 2000);
  }

  function handleShowKey() {
    // Read from localStorage only on click — never during render
    const key = localStorage.getItem("cp_burner_key") || "";
    setPrivateKey(key);
    setShowKey(true);
  }

  function copyKey() {
    const key = localStorage.getItem("cp_burner_key") || "";
    navigator.clipboard.writeText(key);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  }

  function handleOpen() {
    setOpen(!open);
    setShowKey(false);
    setPrivateKey("");
  }

  const pill: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 8,
    fontSize: 13, padding: "6px 14px", borderRadius: 999,
    border: "1px solid rgba(45,106,79,0.3)",
    background: "rgba(216,243,220,0.3)",
    cursor: "pointer", fontFamily: "inherit",
  };

  const dropdown: React.CSSProperties = {
    position: "absolute", right: 0, top: "calc(100% + 8px)",
    width: 300, background: "white",
    border: "1px solid rgba(0,0,0,0.1)",
    borderRadius: 14,
    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
    zIndex: 50, overflow: "hidden",
  };

  const divider: React.CSSProperties = {
    borderTop: "1px solid rgba(0,0,0,0.06)",
  };

  const actionBtn: React.CSSProperties = {
    width: "100%", padding: "8px 14px", borderRadius: 8,
    border: "1px solid rgba(0,0,0,0.1)", fontSize: 13,
    background: "none", cursor: "pointer", fontFamily: "inherit",
    textAlign: "left" as const,
  };

  return (
    <div style={{ position: "relative" }}>
      <button onClick={handleOpen} style={pill}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#74C69D", flexShrink: 0 }} />
        <span style={{ color: "#2D6A4F", fontWeight: 500 }}>
          {wallet.type === "metamask" ? "MetaMask" : "Burner"}
        </span>
        <span style={{ fontFamily: "monospace", color: "#5F6B5A", fontSize: 12 }}>
          {truncate(wallet.address)}
        </span>
      </button>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => { setOpen(false); setShowKey(false); setPrivateKey(""); }} />
          <div style={dropdown}>

            {/* Address */}
            <div style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: "#8A9985", marginBottom: 4 }}>
                {wallet.type === "metamask" ? "MetaMask wallet" : "Burner wallet"}
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "#1A1A18", wordBreak: "break-all", marginBottom: 10 }}>
                {wallet.address}
              </div>
              <button onClick={copyAddress} style={{ ...actionBtn, color: addrCopied ? "#2D6A4F" : "#5F6B5A" }}>
                {addrCopied ? "✓ Address copied!" : "Copy address"}
              </button>
            </div>

            {/* Private key — only for burner */}
            {wallet.type === "burner" && (
              <div style={{ ...divider, padding: "14px 16px", background: "rgba(244,162,97,0.04)" }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#F4A261", marginBottom: 6 }}>
                  ⚠️ Save your private key
                </div>
                <div style={{ fontSize: 12, color: "#5F6B5A", lineHeight: 1.5, marginBottom: 10 }}>
                  This key is stored in this browser only. Copy it now so you can restore your wallet on any browser or device.
                </div>
                {!showKey ? (
                  <button onClick={handleShowKey} style={{ ...actionBtn, color: "#F4A261", borderColor: "rgba(244,162,97,0.4)", background: "rgba(244,162,97,0.06)" }}>
                    Show private key
                  </button>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{
                      fontFamily: "monospace", fontSize: 10, color: "#1A1A18",
                      wordBreak: "break-all", background: "rgba(0,0,0,0.03)",
                      padding: "10px 12px", borderRadius: 8,
                      border: "1px solid rgba(0,0,0,0.08)", lineHeight: 1.6,
                      userSelect: "all" as const,
                    }}>
                      {privateKey}
                    </div>
                    <button onClick={copyKey} style={{ ...actionBtn, color: keyCopied ? "#2D6A4F" : "#F4A261", borderColor: keyCopied ? "rgba(45,106,79,0.4)" : "rgba(244,162,97,0.4)", background: keyCopied ? "rgba(216,243,220,0.3)" : "rgba(244,162,97,0.06)" }}>
                      {keyCopied ? "✓ Key copied! Store it safely." : "Copy private key"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* MetaMask toggle */}
            <div style={{ ...divider, padding: "12px 16px" }}>
              {wallet.type === "burner" ? (
                <button
                  onClick={() => { connectMetaMask(); setOpen(false); }}
                  style={{ ...actionBtn, color: "#2D6A4F", borderColor: "rgba(45,106,79,0.3)", background: "rgba(216,243,220,0.2)", fontWeight: 500 }}
                >
                  Connect MetaMask →
                </button>
              ) : (
                <button
                  onClick={() => { connectBurner(); setOpen(false); }}
                  style={{ ...actionBtn, color: "#5F6B5A" }}
                >
                  Switch to burner key
                </button>
              )}
              <div style={{ fontSize: 11, color: "#8A9985", marginTop: 8, lineHeight: 1.4 }}>
                {wallet.type === "burner"
                  ? "MetaMask display only on studionet — transactions still sign with your burner key."
                  : "To restore your burner: switch back and paste your saved private key."}
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}