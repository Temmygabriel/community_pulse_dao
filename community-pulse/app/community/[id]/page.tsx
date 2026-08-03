"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useWallet } from "@/app/components/wallet/WalletProvider";
import type { Community, Proposal } from "@/lib/types";

// ── Inline helpers — no external imports that could crash ──────────

function formatGEN(raw: number): string {
  if (!raw || raw === 0) return "0 GEN";
  const val = raw / 1e18;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k GEN`;
  if (val >= 1) return `${val.toFixed(2)} GEN`;
  return `${val.toFixed(4)} GEN`;
}

function toRawUnits(gen: number): string {
  const whole = Math.floor(gen);
  const frac = Math.round((gen - whole) * 1e9);
  return (BigInt(whole) * BigInt("1000000000000000000") + BigInt(frac) * BigInt("1000000000")).toString();
}

function communityStatusStyle(status: string) {
  if (status === "active") return { color: "#2D6A4F", background: "rgba(45,106,79,0.1)" };
  if (status === "depleted") return { color: "#E63946", background: "rgba(230,57,70,0.08)" };
  return { color: "#8A9985", background: "rgba(138,153,133,0.1)" };
}

function proposalStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: "Pending", scoring: "Evaluating",
    funded_partial: "Funded", approved_unfunded: "Approved",
    completed: "Completed", completion_failed: "Failed",
    revision: "Revision", rejected: "Rejected",
  };
  return map[status] ?? status;
}

function proposalStatusStyle(status: string) {
  const map: Record<string, { color: string; background: string }> = {
    pending:           { color: "#8A9985", background: "rgba(138,153,133,0.1)" },
    scoring:           { color: "#2D6A4F", background: "rgba(116,198,157,0.15)" },
    funded_partial:    { color: "#2D6A4F", background: "rgba(45,106,79,0.1)" },
    approved_unfunded: { color: "#F4A261", background: "rgba(244,162,97,0.12)" },
    completed:         { color: "#2D6A4F", background: "rgba(45,106,79,0.1)" },
    completion_failed: { color: "#E63946", background: "rgba(230,57,70,0.08)" },
    revision:          { color: "#F4A261", background: "rgba(244,162,97,0.12)" },
    rejected:          { color: "#E63946", background: "rgba(230,57,70,0.08)" },
  };
  return map[status] ?? { color: "#8A9985", background: "rgba(138,153,133,0.1)" };
}

function scoreColor(score: number): string {
  if (score >= 70) return "#2D6A4F";
  if (score >= 50) return "#F4A261";
  return "#E63946";
}

// ── Shared style objects ───────────────────────────────────────────

const card: React.CSSProperties = { background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: 16 };
const cardGreen: React.CSSProperties = { background: "rgba(216,243,220,0.4)", border: "1px solid rgba(45,106,79,0.2)", borderRadius: 12, padding: 16 };
const cardRed: React.CSSProperties = { background: "rgba(230,57,70,0.05)", border: "1px solid rgba(230,57,70,0.2)", borderRadius: 12, padding: 14 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)", fontSize: 14, outline: "none", background: "white", color: "#1A1A18", fontFamily: "inherit", boxSizing: "border-box" };
const btnPrimary: React.CSSProperties = { width: "100%", padding: "12px 24px", borderRadius: 12, background: "#2D6A4F", color: "white", fontWeight: 500, fontSize: 14, border: "none", cursor: "pointer", fontFamily: "inherit" };
const btnGhost: React.CSSProperties = { padding: "8px 14px", borderRadius: 10, border: "1px solid rgba(45,106,79,0.3)", background: "transparent", color: "#2D6A4F", fontSize: 13, cursor: "pointer", fontFamily: "inherit" };

type Tab = "proposals" | "constitution" | "treasury";

export default function CommunityPage() {
  const params = useParams();
  const communityId = (params?.id as string)?.toUpperCase();
  const { wallet, account } = useWallet();

  const [community, setCommunity] = useState<Community | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [tab, setTab] = useState<Tab>("proposals");
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [txLoading, setTxLoading] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [copied, setCopied] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [memberName, setMemberName] = useState("");
  const [showJoinForm, setShowJoinForm] = useState(false);

  const load = useCallback(async () => {
    if (!communityId) return;
    try {
      const { getCommunity, getCommunityProposals, getCommunityMembers } = await import("@/lib/contract");
      const [c, p] = await Promise.all([
        getCommunity(communityId),
        getCommunityProposals(communityId),
      ]);
      if ((c as any).error) { setError("Community not found."); setPageLoading(false); return; }
      setCommunity(c);
      setProposals([...p].sort((a: Proposal, b: Proposal) => b.created_at - a.created_at));
      if (wallet.address) {
        const members = await getCommunityMembers(communityId);
        setIsMember(members.map((m: string) => m.toLowerCase()).includes(wallet.address.toLowerCase()));
      }
    } catch {
      setError("Failed to load community.");
    } finally {
      setPageLoading(false);
    }
  }, [communityId, wallet.address]);

  useEffect(() => { load(); }, [load]);

  async function handleJoin() {
    if (!account || !memberName.trim()) return;
    setTxLoading("join");
    setError("");
    try {
      const { joinCommunity } = await import("@/lib/contract");
      await joinCommunity(account, communityId, memberName.trim());
      // Optimistic update — don't wait for re-fetch which lags behind finalization
      setIsMember(true);
      setShowJoinForm(false);
      // Re-fetch in background to update member count
      load().catch(() => {});
    } catch (e: any) {
      setError(e?.message || "Failed to join. Try again.");
    } finally {
      setTxLoading("");
    }
  }

  async function handleDeposit() {
    if (!account || !depositAmount) return;
    const gen = parseFloat(depositAmount);
    if (!gen || gen <= 0) return;
    setTxLoading("deposit");
    setError("");
    try {
      const { depositFunds } = await import("@/lib/contract");
      await depositFunds(account, communityId, toRawUnits(gen));
      setDepositAmount("");
      await load();
    } catch (e: any) {
      setError(e?.message || "Deposit failed.");
    } finally {
      setTxLoading("");
    }
  }

  function copyId() {
    navigator.clipboard.writeText(communityId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (pageLoading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: "5rem 0", color: "#8A9985", fontSize: 14 }}>
      Loading community...
    </div>
  );

  if (error && !community) return (
    <div style={{ ...cardRed, margin: "2rem 0", color: "#E63946", fontSize: 14 }}>{error}</div>
  );

  if (!community) return null;

  const cs = communityStatusStyle(community.status);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* Back */}
      <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "#5F6B5A", textDecoration: "none" }}>
        ← All communities
      </a>

      {/* Header */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
          <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", color: "#1A1A18", margin: 0, lineHeight: 1.2 }}>
            {community.name}
          </h1>
          <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 999, flexShrink: 0, ...cs }}>
            {community.status}
          </span>
        </div>
        <p style={{ color: "#5F6B5A", fontSize: 14, margin: "0 0 4px", lineHeight: 1.5 }}>{community.description}</p>
        <div style={{ fontSize: 12, color: "#8A9985" }}>
          Founded by <span style={{ color: "#5F6B5A" }}>{community.founder_name}</span>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
        {[
          { label: "Pot", value: formatGEN(community.pot_balance) },
          { label: "Members", value: String(community.member_count) },
          { label: "Funded", value: String(community.funded_count) },
          { label: "Completed", value: String(community.completed_count) },
        ].map(({ label, value }) => (
          <div key={label} style={{ ...card, textAlign: "center", padding: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#2D6A4F" }}>{value}</div>
            <div style={{ fontSize: 11, color: "#8A9985", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Community ID */}
      <div style={{ ...cardGreen, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#5F6B5A", marginBottom: 4 }}>Community ID — share to invite members</div>
          <div style={{ fontFamily: "monospace", fontWeight: 700, color: "#2D6A4F", fontSize: 20, letterSpacing: "0.1em" }}>
            {communityId}
          </div>
        </div>
        <button onClick={copyId} style={{ ...btnGhost, flexShrink: 0 }}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Join */}
      {wallet.connected && !isMember && (
        <div style={card}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#1A1A18", marginBottom: 12 }}>Join this community</div>
          {showJoinForm ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                style={inputStyle}
                placeholder="Your display name"
                value={memberName}
                onChange={e => setMemberName(e.target.value)}
                maxLength={30}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleJoin}
                  disabled={!memberName.trim() || txLoading === "join"}
                  style={{ ...btnPrimary, flex: 1, opacity: (!memberName.trim() || txLoading === "join") ? 0.5 : 1 }}
                >
                  {txLoading === "join" ? "Joining..." : "Confirm join →"}
                </button>
                <button onClick={() => setShowJoinForm(false)} style={btnGhost}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowJoinForm(true)} style={btnPrimary}>
              Join community →
            </button>
          )}
        </div>
      )}

      {/* Depleted warning */}
      {community.status === "depleted" && (
        <div style={{ ...cardRed, color: "#E63946", fontSize: 13 }}>
          The pot is depleted. Deposit funds to re-activate proposal submissions.
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(0,0,0,0.08)", gap: 24 }}>
        {(["proposals", "constitution", "treasury"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              paddingBottom: 10, fontSize: 14, fontWeight: tab === t ? 500 : 400,
              color: tab === t ? "#2D6A4F" : "#5F6B5A",
              border: "none", borderBottom: `2px solid ${tab === t ? "#2D6A4F" : "transparent"}`,
              background: "transparent", cursor: "pointer", fontFamily: "inherit",
              textTransform: "capitalize", marginBottom: -1, transition: "color 0.15s",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── PROPOSALS TAB ── */}
      {tab === "proposals" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, color: "#8A9985" }}>
              {proposals.length} proposal{proposals.length !== 1 ? "s" : ""}
            </div>
            {isMember && community.status === "active" && (
              <Link
                href={`/community/${communityId}/propose`}
                style={{ fontSize: 13, fontWeight: 500, color: "#2D6A4F", textDecoration: "none" }}
              >
                + Submit proposal
              </Link>
            )}
          </div>

          {proposals.length === 0 ? (
            <div style={{ ...card, textAlign: "center", padding: "2rem", color: "#8A9985", fontSize: 14 }}>
              No proposals yet.{isMember ? " Be the first to submit one." : " Join to submit a proposal."}
            </div>
          ) : (
            proposals.map(p => {
              const isOwn = wallet.address && p.proposer.toLowerCase() === wallet.address.toLowerCase();
              const ps = proposalStatusStyle(p.status);
              return (
                <Link key={p.id} href={`/proposal/${p.id}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    ...card,
                    cursor: "pointer",
                    borderColor: isOwn ? "rgba(45,106,79,0.25)" : "rgba(0,0,0,0.08)",
                    transition: "border-color 0.15s",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, color: "#1A1A18", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.title}
                          {isOwn && <span style={{ fontSize: 11, color: "#2D6A4F", marginLeft: 8 }}>(yours)</span>}
                          {p.is_revision && <span style={{ fontSize: 11, color: "#8A9985", marginLeft: 8 }}>↩ revision</span>}
                        </div>
                        <div style={{ fontSize: 12, color: "#5F6B5A", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {p.what_it_does}
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 999, ...ps }}>
                          {proposalStatusLabel(p.status)}
                        </span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#2D6A4F" }}>
                          {formatGEN(p.amount)}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#8A9985" }}>
                      <span>by {p.proposer_name || p.proposer.slice(0, 8) + "…"}</span>
                      <span>❤️ {p.pulse_count}</span>
                      {p.total_score !== null && (
                        <span style={{ color: scoreColor(p.total_score), fontWeight: 600 }}>
                          {p.total_score}/100
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      )}

      {/* ── CONSTITUTION TAB ── */}
      {tab === "constitution" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ ...cardGreen, fontSize: 13, color: "#5F6B5A", lineHeight: 1.5 }}>
            The AI reads these five sentences before scoring every proposal. They are permanent and cannot be changed after the community is created.
          </div>
          {[
            { tag: "🎯 PURPOSE", key: "purpose" },
            { tag: "✅ WE ALWAYS FUND", key: "always_fund" },
            { tag: "🚫 WE NEVER FUND", key: "never_fund" },
            { tag: "👥 WHO BENEFITS", key: "who_benefits" },
            { tag: "🏆 SUCCESS LOOKS LIKE", key: "success_looks_like" },
          ].map(({ tag, key }) => (
            <div key={key} style={card}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#2D6A4F", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                {tag}
              </div>
              <div style={{ fontSize: 14, color: "#1A1A18", lineHeight: 1.6 }}>
                {community.constitution[key as keyof typeof community.constitution]}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── TREASURY TAB ── */}
      {tab === "treasury" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ ...cardGreen, textAlign: "center", padding: "1.5rem 1rem" }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#2D6A4F" }}>{formatGEN(community.pot_balance)}</div>
            <div style={{ fontSize: 12, color: "#5F6B5A", marginTop: 4 }}>Current pot balance</div>
            {community.status === "depleted" && (
              <div style={{ fontSize: 12, color: "#E63946", marginTop: 6 }}>Pot depleted — deposit to re-activate</div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {[
              { label: "Total funded", value: formatGEN(community.total_funded) },
              { label: "Threshold", value: `${community.funding_threshold}/100` },
              { label: "Upfront %", value: `${community.upfront_release_pct}%` },
            ].map(({ label, value }) => (
              <div key={label} style={{ ...card, textAlign: "center", padding: 12 }}>
                <div style={{ fontWeight: 600, color: "#1A1A18" }}>{value}</div>
                <div style={{ fontSize: 11, color: "#8A9985" }}>{label}</div>
              </div>
            ))}
          </div>

          {wallet.connected && (
            <div style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#1A1A18" }}>Deposit funds</div>
              <div style={{ fontSize: 12, color: "#8A9985" }}>Anyone can deposit. Funds go directly into the community pot.</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="number"
                  style={{ ...inputStyle, flex: 1 }}
                  placeholder="Amount in GEN (e.g. 2.5)"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  min="0.001"
                  step="0.1"
                />
                <button
                  onClick={handleDeposit}
                  disabled={!depositAmount || txLoading === "deposit"}
                  style={{ ...btnPrimary, width: "auto", padding: "12px 20px", opacity: (!depositAmount || txLoading === "deposit") ? 0.5 : 1 }}
                >
                  {txLoading === "deposit" ? "..." : "Deposit →"}
                </button>
              </div>
            </div>
          )}

          <div style={{ ...card, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "#5F6B5A", marginBottom: 4 }}>
              Governance rules
            </div>
            {[
              ["Funding threshold", `${community.funding_threshold}/100`],
              ["Max proposal size", `${community.max_proposal_pct}% of pot`],
              ["Proposal fee", formatGEN(community.proposal_fee)],
              ["Upfront on approval", `${community.upfront_release_pct}%`],
              ["Escrowed until delivery", `${100 - community.upfront_release_pct}%`],
              ["Revision rounds", "1 per proposal"],
              ["Pulse bonus", "Up to +5 points"],
            ].map(([label, value]) => (
              <div key={label as string} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                <span style={{ color: "#5F6B5A" }}>{label}</span>
                <span style={{ fontWeight: 500, color: "#1A1A18" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div style={{ ...cardRed, color: "#E63946", fontSize: 13 }}>{error}</div>
      )}
    </div>
  );
}