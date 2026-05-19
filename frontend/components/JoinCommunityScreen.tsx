"use client";
// CommunityPulse — Join Community Screen
// Session 4

import { useState } from "react";
import { Community } from "../types";
import { getCommunity } from "../lib/contract";

interface JoinCommunityProps {
  playerName: string;
  onJoin: (communityId: string, name: string) => void;
  onBack: () => void;
  loading: string;
  error: string;
}

type LookupState = "idle" | "loading" | "found" | "error";

export default function JoinCommunityScreen({
  playerName,
  onJoin,
  onBack,
  loading,
  error,
}: JoinCommunityProps) {
  const [communityId, setCommunityId] = useState("");
  const [nameInput, setNameInput] = useState(playerName);
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [foundCommunity, setFoundCommunity] = useState<Community | null>(null);
  const [lookupError, setLookupError] = useState("");

  const isLoading = !!loading;

  async function handleLookup() {
    const trimmed = communityId.trim().toUpperCase();
    if (!trimmed) return;

    setLookupState("loading");
    setLookupError("");
    setFoundCommunity(null);

    try {
      const data = await getCommunity(trimmed);
      if (data.error) {
        setLookupState("error");
        setLookupError("Community not found. Check the ID and try again.");
        return;
      }
      setFoundCommunity(data);
      setLookupState("found");
    } catch {
      setLookupState("error");
      setLookupError("Could not reach the contract. Check your connection.");
    }
  }

  function handleJoin() {
    if (!foundCommunity || !nameInput.trim()) return;
    onJoin(foundCommunity.id, nameInput.trim());
  }

  const constitutionTags = foundCommunity
    ? [
        { label: "Purpose", value: foundCommunity.constitution.purpose },
        { label: "Always Fund", value: foundCommunity.constitution.always_fund },
        { label: "Never Fund", value: foundCommunity.constitution.never_fund },
      ]
    : [];

  return (
    <div className="screen fadeIn">
      <button className="back-btn" onClick={onBack}>← Back</button>

      <h2 className="screen-title">Join a Community</h2>
      <p className="screen-sub">
        Enter a Community ID to look it up, then join with your name.
      </p>

      {/* ── Lookup form ── */}
      <div className="form-section">
        <div className="form-section-title">Find Community</div>

        <div style={{ display: "flex", gap: "10px" }}>
          <input
            type="text"
            placeholder="COM000001"
            value={communityId}
            onChange={(e) => {
              setCommunityId(e.target.value.toUpperCase());
              setLookupState("idle");
              setFoundCommunity(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            maxLength={9}
            style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "20px", letterSpacing: "0.1em", flex: 1 }}
          />
          <button
            className="btn-outline"
            onClick={handleLookup}
            disabled={!communityId.trim() || lookupState === "loading"}
            style={{ width: "auto", padding: "0 1.5rem", whiteSpace: "nowrap" }}
          >
            {lookupState === "loading" ? (
              <span className="btn-loading"><span className="spinner" />Looking up...</span>
            ) : (
              "Look Up"
            )}
          </button>
        </div>

        {lookupError && <p className="error-text">{lookupError}</p>}
      </div>

      {/* ── Community preview ── */}
      {lookupState === "found" && foundCommunity && (
        <div
          className="card card--green fadeIn"
          style={{ display: "flex", flexDirection: "column", gap: "14px" }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.6rem", letterSpacing: "0.04em", color: "#F0F0F0", lineHeight: 1.1 }}>
                {foundCommunity.name}
              </div>
              <div style={{ fontSize: "13px", color: "#888899", marginTop: "4px", lineHeight: 1.5 }}>
                {foundCommunity.description}
              </div>
            </div>
            <span className={`status-badge status-badge--${foundCommunity.status}`}>
              {foundCommunity.status}
            </span>
          </div>

          {/* Stats */}
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            {[
              ["👥", foundCommunity.member_count, "members"],
              ["💰", foundCommunity.pot_balance, "in pot"],
              ["✅", foundCommunity.funded_count, "funded"],
              ["🎯", `${foundCommunity.funding_threshold}/100`, "threshold"],
            ].map(([icon, val, lbl]) => (
              <div key={String(lbl)} style={{ display: "flex", flex-direction: "column", gap: "2px" }}>
                <div style={{ fontSize: "13px", color: "#F0F0F0", fontWeight: 600 }}>
                  {icon} {val}
                </div>
                <div style={{ fontSize: "11px", color: "#555566", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {lbl}
                </div>
              </div>
            ))}
          </div>

          {/* Constitution peek */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#888899" }}>
              Constitution
            </div>
            {constitutionTags.map(({ label, value }) => (
              <div key={label} style={{ fontSize: "13px", color: "#888899", lineHeight: 1.5 }}>
                <span style={{ color: "#00D4FF", fontWeight: 700, fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {label}:{" "}
                </span>
                {value}
              </div>
            ))}
          </div>

          {/* Founder */}
          <div style={{ fontSize: "12px", color: "#555566" }}>
            Founded by <strong style={{ color: "#888899" }}>{foundCommunity.founder_name}</strong>
          </div>
        </div>
      )}

      {/* ── Join form — shown once community found ── */}
      {lookupState === "found" && foundCommunity && (
        <div className="form-section fadeIn">
          <div className="form-section-title">Join as</div>

          <div className="field-group">
            <label className="field-label">Your Display Name</label>
            <input
              type="text"
              placeholder="How the community will see you..."
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              maxLength={30}
            />
          </div>

          {foundCommunity.status === "depleted" && (
            <div
              style={{
                padding: "12px 14px",
                background: "rgba(255,77,109,0.06)",
                border: "1px solid rgba(255,77,109,0.2)",
                borderRadius: "12px",
                fontSize: "13px",
                color: "#FF4D6D",
                lineHeight: 1.5,
              }}
            >
              ⚠️ This community's pot is depleted. You can join and propose once funds are deposited.
            </div>
          )}

          {error && <p className="error-text">{error}</p>}

          <button
            className="btn-primary"
            onClick={handleJoin}
            disabled={!nameInput.trim() || isLoading}
          >
            {isLoading ? (
              <span className="btn-loading">
                <span className="spinner" />
                {loading}
              </span>
            ) : (
              `Join ${foundCommunity.name} →`
            )}
          </button>
        </div>
      )}

      {/* ── Tip ── */}
      <div
        style={{
          padding: "14px 16px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "12px",
          fontSize: "13px",
          color: "#555566",
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: "#888899" }}>Tip:</strong> Ask the community founder for the ID — it looks like <span style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.08em", color: "#F0F0F0" }}>COM000001</span>. You can also find communities on the landing screen.
      </div>
    </div>
  );
}
