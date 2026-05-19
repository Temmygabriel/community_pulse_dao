"use client";
// CommunityPulse — Community Dashboard
// Session 5

import { Community, Screen } from "../types";

interface CommunityDashboardProps {
  community: Community;
  playerAddress: string;
  onNavigate: (screen: Screen) => void;
  onBack: () => void;
  loading: string;
  error: string;
}

export default function CommunityDashboard({
  community,
  playerAddress,
  onNavigate,
  onBack,
  loading,
  error,
}: CommunityDashboardProps) {
  const isFounder = community.founder === playerAddress;
  const maxProposal = Math.floor(community.pot_balance * community.max_proposal_pct / 100);

  function copyId() {
    navigator.clipboard.writeText(community.id);
  }

  return (
    <div className="screen fadeIn">
      <button className="back-btn" onClick={onBack}>← Home</button>

      {/* ── Community header ── */}
      <div className="community-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
          <div>
            <div className="community-header-name">{community.name}</div>
            {isFounder && (
              <div style={{ fontSize: "11px", color: "#00FF87", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", marginTop: "2px" }}>
                👑 You founded this
              </div>
            )}
          </div>
          <span className={`status-badge status-badge--${community.status}`}>
            {community.status}
          </span>
        </div>

        <div className="community-header-desc">{community.description}</div>

        <div className="community-header-stats">
          <div className="community-stat">
            <div className="community-stat-val">{community.pot_balance.toLocaleString()}</div>
            <div className="community-stat-lbl">Pot Balance</div>
          </div>
          <div className="community-stat">
            <div className="community-stat-val">{community.member_count}</div>
            <div className="community-stat-lbl">Members</div>
          </div>
          <div className="community-stat">
            <div className="community-stat-val">{community.funded_count}</div>
            <div className="community-stat-lbl">Funded</div>
          </div>
          <div className="community-stat">
            <div className="community-stat-val">{community.funding_threshold}</div>
            <div className="community-stat-lbl">Threshold</div>
          </div>
        </div>

        {/* Community ID banner */}
        <div className="id-banner">
          <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
            <div className="id-banner-label">Community ID — share to invite members</div>
            <div className="id-banner-value">{community.id}</div>
          </div>
          <button className="id-banner-copy" onClick={copyId}>Copy</button>
        </div>
      </div>

      {/* ── Pot status alert ── */}
      {community.status === "depleted" && (
        <div
          style={{
            padding: "14px 16px",
            background: "rgba(255,77,109,0.06)",
            border: "1px solid rgba(255,77,109,0.25)",
            borderRadius: "12px",
            fontSize: "14px",
            color: "#FF4D6D",
            lineHeight: 1.6,
          }}
        >
          ⚠️ The pot is depleted. Deposit funds to re-activate proposal submissions.
          <button
            className="btn-danger"
            onClick={() => onNavigate("treasury")}
            style={{ marginTop: "10px", width: "auto", padding: "0.6rem 1.2rem", fontSize: "0.9rem" }}
          >
            Go to Treasury →
          </button>
        </div>
      )}

      {/* ── Nav grid ── */}
      <div className="section-label">What do you want to do?</div>
      <div className="dashboard-nav">

        <button className="dashboard-nav-item" onClick={() => onNavigate("proposal_feed")}>
          <div className="dashboard-nav-icon">📋</div>
          <div className="dashboard-nav-label">Proposals</div>
          <div className="dashboard-nav-sub">{community.proposal_count} submitted</div>
        </button>

        <button
          className="dashboard-nav-item"
          onClick={() => onNavigate("submit_proposal")}
          disabled={community.status === "depleted"}
          style={{ opacity: community.status === "depleted" ? 0.5 : 1 }}
        >
          <div className="dashboard-nav-icon">✍️</div>
          <div className="dashboard-nav-label">Submit Proposal</div>
          <div className="dashboard-nav-sub">Max {maxProposal.toLocaleString()} from pot</div>
        </button>

        <button className="dashboard-nav-item" onClick={() => onNavigate("treasury")}>
          <div className="dashboard-nav-icon">💰</div>
          <div className="dashboard-nav-label">Treasury</div>
          <div className="dashboard-nav-sub">{community.total_funded.toLocaleString()} total funded</div>
        </button>

        <button className="dashboard-nav-item" onClick={() => onNavigate("constitution")}>
          <div className="dashboard-nav-icon">⚖️</div>
          <div className="dashboard-nav-label">Constitution</div>
          <div className="dashboard-nav-sub">5 governing rules</div>
        </button>

      </div>

      {/* ── Quick stats ── */}
      <div
        style={{
          padding: "16px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: "14px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <div className="section-label">Governance Rules</div>
        {[
          ["🎯", `Proposals need ${community.funding_threshold}/100 to be funded`],
          ["📏", `Max proposal size: ${community.max_proposal_pct}% of pot (${maxProposal.toLocaleString()})`],
          ["🎟️", `Proposal fee: ${community.proposal_fee} (goes into pot)`],
          ["💡", "Scores 50–69 enter revision — one resubmit allowed"],
          ["❤️", "Community pulses add up to 5 bonus points"],
        ].map(([icon, text]) => (
          <div key={String(text)} style={{ display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "13px", color: "#888899", lineHeight: 1.5 }}>
            <span style={{ flexShrink: 0, fontSize: "15px" }}>{icon}</span>
            <span>{text}</span>
          </div>
        ))}
      </div>

      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
