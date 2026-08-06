"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const KEY = "cp_burner_key";

// Standalone wallet — no provider, no context, no genlayer-js on server
// Wallet state lives entirely in this component
// Address is derived from the private key stored in localStorage
// If no key exists, one is generated and saved immediately
export function Header() {
  const [address, setAddress] = useState("");
  const [open, setOpen] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [privateKey, setPrivateKey] = useState("");
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const run = async () => {
      const saved = localStorage.getItem(KEY);
      const { makeAccount } = await import("@/lib/contract");

      let acc;
      if (saved && saved.startsWith("0x") && saved.length >= 66) {
        acc = makeAccount(saved as `0x${string}`);
      } else {
        acc = makeAccount();
        localStorage.setItem(KEY, acc.privateKey);
      }

      setAddress(acc.address);

      // Also expose account globally so pages can access it
      (window as any).__cp_account = acc;
    };

    run();
  }, []);

  function truncate(addr: string) {
    if (!addr) return "";
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }

  function copyAddress() {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleShowKey() {
    const k = localStorage.getItem(KEY) || "Not found";
    setPrivateKey(k);
    setShowKey(true);
  }

  function copyKey() {
    const k = localStorage.getItem(KEY) || "";
    if (!k) return;
    navigator.clipboard.writeText(k);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  }

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 30,
      background: "rgba(250,250,248,0.9)", backdropFilter: "blur(8px)",
      borderBottom: "1px solid rgba(0,0,0,0.06)",
    }}>
      <div style={{
        maxWidth: 640, margin: "0 auto", padding: "0 1rem",
        height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Link href="/" style={{
          display: "flex", alignItems: "center", gap: 10,
          textDecoration: "none",
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: "#2D6A4F",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="4" fill="white" />
              <circle cx="12" cy="12" r="7.5" stroke="white" strokeWidth="1.5"
                strokeDasharray="2.5 2" strokeLinecap="round" />
              <circle cx="12" cy="3.5" r="1.5" fill="#74C69D" />
              <circle cx="19.5" cy="16.5" r="1.5" fill="#74C69D" />
              <circle cx="4.5" cy="16.5" r="1.5" fill="#74C69D" />
            </svg>
          </div>
          <span style={{ fontWeight: 600, color: "#1A1A18", letterSpacing: "-0.01em" }}>
            CommunityPulse
          </span>
        </Link>

        {address ? (
          <div style={{ position: "relative" }}>
            <button
              onClick={() => { setOpen(!open); setShowKey(false); setPrivateKey(""); }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                fontSize: 13, padding: "6px 14px", borderRadius: 999,
                border: "1px solid rgba(45,106,79,0.3)",
                background: "rgba(216,243,220,0.3)",
                cursor: "pointer", fontFamily: "inherit",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#74C69D" }} />
              <span style={{ color: "#2D6A4F", fontWeight: 500 }}>Burner</span>
              <span style={{ fontFamily: "monospace", color: "#5F6B5A", fontSize: 12 }}>
                {truncate(address)}
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
                    <div style={{ fontSize: 11, color: "#8A9985", marginBottom: 4 }}>Burner wallet</div>
                    <div style={{
                      fontFamily: "monospace", fontSize: 11, color: "#1A1A18",
                      wordBreak: "break-all", marginBottom: 10, lineHeight: 1.5,
                    }}>
                      {address}
                    </div>
                    <button onClick={copyAddress} style={{
                      width: "100%", padding: "8px 14px", borderRadius: 8,
                      border: "1px solid rgba(0,0,0,0.1)", fontSize: 13,
                      background: "none", cursor: "pointer", fontFamily: "inherit",
                      color: copied ? "#2D6A4F" : "#5F6B5A",
                    }}>
                      {copied ? "✓ Copied!" : "Copy address"}
                    </button>
                  </div>

                  {/* Private key */}
                  <div style={{
                    borderTop: "1px solid rgba(0,0,0,0.06)",
                    padding: "14px 16px",
                    background: "rgba(244,162,97,0.04)",
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#F4A261", marginBottom: 6 }}>
                      ⚠️ Save your private key
                    </div>
                    <div style={{ fontSize: 12, color: "#5F6B5A", lineHeight: 1.5, marginBottom: 10 }}>
                      Stored in this browser only. Save it to restore your wallet anywhere.
                    </div>
                    {!showKey ? (
                      <button onClick={handleShowKey} style={{
                        width: "100%", padding: "8px 14px", borderRadius: 8,
                        border: "1px solid rgba(244,162,97,0.4)",
                        background: "rgba(244,162,97,0.06)",
                        color: "#F4A261", fontSize: 13,
                        cursor: "pointer", fontFamily: "inherit",
                      }}>
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
                        <button onClick={copyKey} style={{
                          width: "100%", padding: "8px 14px", borderRadius: 8,
                          border: `1px solid ${keyCopied ? "rgba(45,106,79,0.4)" : "rgba(244,162,97,0.4)"}`,
                          background: keyCopied ? "rgba(216,243,220,0.3)" : "rgba(244,162,97,0.06)",
                          color: keyCopied ? "#2D6A4F" : "#F4A261",
                          fontSize: 13, cursor: "pointer", fontFamily: "inherit",
                        }}>
                          {keyCopied ? "✓ Key copied! Store it safely." : "Copy private key"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Warning */}
                  <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                    <div style={{ fontSize: 11, color: "#8A9985", lineHeight: 1.5 }}>
                      Don't clear browser data or you'll lose access. Save the private key above to restore on any device.
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ width: 120, height: 32, borderRadius: 999, background: "rgba(0,0,0,0.04)" }} />
        )}
      </div>
    </header>
  );
}