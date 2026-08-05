"use client";
import { useState } from "react";
import { useWallet } from "./WalletProvider";

const KEY_NAME = "cp_burner_key";

function truncate(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletButton() {
  const { wallet, connectMetaMask, connectBurner } = useWallet();
  const [open, setOpen] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [privateKey, setPrivateKey] = useState("");
  const [keyCopied, setKeyCopied] = useState(false);
  const [addrCopied, setAddrCopied] = useState(false);

  // Don't render until wallet is connected (after useEffect fires on client)
  if (!wallet.connected || !wallet.address) return null;

  function handleOpen() {
    setOpen(!open);
    setShowKey(false);
    setPrivateKey("");
    setKeyCopied(false);
    setAddrCopied(false);
  }

  function copyAddress() {
    navigator.clipboard.writeText(wallet.address);
    setAddrCopied(true);
    setTimeout(() => setAddrCopied(false), 2000);
  }

  function handleShowKey() {
    // Read from localStorage only on click — safe, always client-side
    const key = localStorage.getItem(KEY_NAME) || "";
    setPrivateKey(key || "No key found.");
    setShowKey(true);
  }

  function copyKey() {
    const key = localStorage.getItem(KEY_NAME) || "";
    if (!key) return;
    navigator.clipboard.writeText(key);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={handleOpen}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          fontSize: 13, padding: "6px 14px", borderRadius: 999,
          border: "1px solid rgba(45,106,79,0.3)",
          background: "rgba(216,243,220,0.3)",
          cursor: "pointer", fontFamily: "inherit",
        }}
      >
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
          <div
            style={{ position: "fixed", inset: 0, zIndex: 40 }}
            onClick={() => { setOpen(false); setShowKey(false); setPrivateKey(""); }}
          />
          <div style={{
            position: "absolute", right: 0, top: "calc(100% + 8px)",
            width: 300, background: "white",
            border: "1px solid rgba(0,0,0,0.1)", borderRadius: 14,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 50, overflow: "hidden",
          }}>

            {/* Address */}
            <div style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: "#8A9985", marginBottom: 4 }}>
                {wallet.type === "metamask" ? "MetaMask wallet" : "Burner wallet"}
              </div>
              <div style={{
                fontFamily: "monospace", fontSize: 11, color: "#1A1A18",
                wordBreak: "break-all", marginBottom: 10, lineHeight: 1.5,
              }}>
                {wallet.address}
              </div>
              <button
                onClick={copyAddress}
                style={{
                  width: "100%", padding: "8px 14px", borderRadius: 8,
                  border: "1px solid rgba(0,0,0,0.1)", fontSize: 13,
                  background: "none", cursor: "pointer", fontFamily: "inherit",
                  color: addrCopied ? "#2D6A4F" : "#5F6B5A",
                }}
              >
                {addrCopied ? "✓ Copied!" : "Copy address"}
              </button>
            </div>

            {/* Private key — burner only */}
            {wallet.type === "burner" && (
              <div style={{
                borderTop: "1px solid rgba(0,0,0,0.06)",
                padding: "14px 16px",
                background: "rgba(244,162,97,0.04)",
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#F4A261", marginBottom: 6 }}>
                  ⚠️ Save your private key
                </div>
                <div style={{ fontSize: 12, color: "#5F6B5A", lineHeight: 1.5, marginBottom: 10 }}>
                  Stored in this browser only. Save it to restore your wallet on any device.
                </div>
                {!showKey ? (
                  <button
                    onClick={handleShowKey}
                    style={{
                      width: "100%", padding: "8px 14px", borderRadius: 8,
                      border: "1px solid rgba(244,162,97,0.4)",
                      background: "rgba(244,162,97,0.06)",
                      color: "#F4A261", fontSize: 13,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    Show private key
                  </button>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{
                      fontFamily: "monospace", fontSize: 10, color: "#1A1A18",
                      wordBreak: "break-all", background: "rgba(0,0,0,0.03)",
                      padding: "10px 12px", borderRadius: 8,
                      border: "1px solid rgba(0,0,0,0.08)",
                      lineHeight: 1.6, userSelect: "all" as const,
                    }}>
                      {privateKey}
                    </div>
                    <button
                      onClick={copyKey}
                      style={{
                        width: "100%", padding: "8px 14px", borderRadius: 8,
                        border: `1px solid ${keyCopied ? "rgba(45,106,79,0.4)" : "rgba(244,162,97,0.4)"}`,
                        background: keyCopied ? "rgba(216,243,220,0.3)" : "rgba(244,162,97,0.06)",
                        color: keyCopied ? "#2D6A4F" : "#F4A261",
                        fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                      }}
                    >
                      {keyCopied ? "✓ Key copied! Store it safely." : "Copy private key"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* MetaMask toggle */}
            <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", padding: "12px 16px" }}>
              {wallet.type === "burner" ? (
                <button
                  onClick={() => { connectMetaMask(); setOpen(false); }}
                  style={{
                    width: "100%", padding: "8px 14px", borderRadius: 8,
                    border: "1px solid rgba(45,106,79,0.3)",
                    background: "rgba(216,243,220,0.2)",
                    color: "#2D6A4F", fontWeight: 500, fontSize: 13,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Connect MetaMask →
                </button>
              ) : (
                <button
                  onClick={() => { connectBurner(); setOpen(false); }}
                  style={{
                    width: "100%", padding: "8px 14px", borderRadius: 8,
                    border: "1px solid rgba(0,0,0,0.1)",
                    background: "none", color: "#5F6B5A", fontSize: 13,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Switch to burner key
                </button>
              )}
              <div style={{ fontSize: 11, color: "#8A9985", marginTop: 8, lineHeight: 1.4 }}>
                {wallet.type === "burner"
                  ? "MetaMask is display only on studionet — all transactions sign with your burner key."
                  : "Switch back to use your saved burner key for signing."}
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}