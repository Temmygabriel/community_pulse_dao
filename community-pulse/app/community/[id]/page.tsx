"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useWallet } from "@/app/components/wallet/WalletProvider";
import type { Community, Proposal } from "@/lib/types";

function formatGEN(raw: number): string {
  if (!raw || raw === 0) return "0 GEN";
  const val = raw / 1e18;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k GEN`;
  if (val >= 1) return `${val.toFixed(2)} GEN`;
  return `${val.toFixed(4)} GEN`;
}

function statusColor(status: string) {
  if (status === "active") return { color: "#2D6A4F", bg: "rgba(45,106,79,0.1)" };
  if (status === "depleted") return { color: "#E63946", bg: "rgba(230,57,70,0.08)" };
  return { color: "#8A9985", bg: "rgba(138,153,133,0.1)" };
}

function proposalStatusColor(status: string) {
  const map: Record<string, { color: string; bg: string }> = {
    pending:          { color: "#8A9985", bg: "rgba(138,153,133,0.1)" },
    scoring:          { color: "#2D6A4F", bg: "rgba(116,198,157,0.15)" },
    funded_partial:   { color: "#2D6A4F", bg: "rgba(45,106,79,0.1)" },
    approved_unfunded:{ color: "#F4A261", bg: "rgba(244,162,97,0.12)" },
    completed:        { color: "#2D6A4F", bg: "rgba(45,106,79,0.1)" },
    completion_failed:{ color: "#E63946", bg: "rgba(230,57,70,0.08)" },
    revision:         { color: "#F4A261", bg: "rgba(244,162,97,0.12)" },
    rejected:         { color: "#E63946", bg: "rgba(230,57,70,0.08)" },
  };
  return map[status] ?? { color: "#8A9985", bg: "rgba(138,153,133,0.1)" };
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    pending: "Pending", scoring: "Evaluating",
    funded_partial: "Funded", approved_unfunded: "Approved",
    completed: "Completed", completion_failed: "Failed",
    revision: "Revision", rejected: "Rejected",
  };
  return map[status] ?? status;
}

type Tab = "proposals" | "constitution" | "treasury";

const s = {
  card: { background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: 16 } as React.CSSProperties,
  cardGreen: { background: "rgba(216,243,220,0.4)", border: "1px solid rgba(45,106,79,0.2)", borderRadius: 12, padding: 16 } as React.CSSProperties,
  label: { fontSize: 11, fontWeight: 500 as const, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#5F6B5A", marginBottom: 8, display: "block" } as React.CSSProperties,
  input: { width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)", fontSize: 14, outline: "none", background: "white", color: "#1A1A18", fontFamily: "inherit", boxSizing: "border-box" as const } as React.CSSProperties,
  btnPrimary: { width: "100%", padding: "12px 24px", borderRadius: 12, background: "#2D6A4F", color: "white", fontWeight: 500 as const, fontSize: 14, border: "none", cursor: "pointer" as const, fontFamily: "inherit" } as React.CSSProperties,
  btnSecondary: { padding: "8px 16px", borderRadius: 10, border: "1px solid rgba(45,106,79,0.3)", background: "transparent", color: "#2D6A4F", fontWeight: 500 as const, fontSize: 13, cursor: "pointer" as const, fontFamily: "inherit" } as React.CSSProperties,
};

export default function CommunityPage() {
  const params = useParams();
  const communityId = (params?.id as string)?.toUpperCase();
  const { wallet, account } = useWallet();

  const [community, setCommunity] = useState<Community | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [tab, setTab] = useState<Tab>("proposals");
  const [loading, setLoading] = useState(true);
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
      const [c, p] = await Promise.all([getCommunity(communityId), getCommunityProposals(communityId)]);
      if ((c as any).error) { setError("Community not found."); setLoading(false); return; }
      setCommunity(c);
      setProposals([...p].sort((a: Proposal, b: Proposal) => b.created_at - a.created_at));
      if (wallet.address) {
        const members = await getCommunityMembers(communityId);
        setIsMember(members.map((m: string) => m.toLowerCase()).includes(wallet.address.toLowerCase()));
      }
    } catch (e) {
      setError("Failed to load community.");
    } finally {
      setLoading(false);
    }
  }, [communityId, wallet.address]);

  useEffect(() => { load(); }, [load]);

  async function handleJoin() {
    if (!account || !memberName.trim()) return;
    setTxLoading("join");
    try {
      const { joinCommunity } = await import("@/lib/contract");
      await joinCommunity(account, communityId, memberName.trim());
      setIsMember(true);
      setShowJoinForm(false);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to join.");
    } finally { setTxLoading(""); }
  }

  async function handleDeposit() {
    if (!account || !depositAmount) return;
    const gen = parseFloat(depositAmount);
    if (!gen || gen <= 0) return;
    setTxLoading("deposit");
    try {
      const { depositFunds } = await import("@/lib/contract");
      const whole = Math.floor(gen);
      const frac = Math.round((gen - whole) * 1e9);
      const raw = (BigInt(whole) * BigInt("1000000000000000000") + BigInt(frac) * BigInt("1000000000")).toString();
      await depositFunds(account, communityId, raw);
      setDepositAmount("");
      await load();
    } catch (e: any) {
      setError(e?.message || "Deposit failed.");
    } finally { setTxLoading(""); }
  }

  function copyId() {
    navigator.clipboard.writeText(communityId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return (
    <div style={{ display: "flex", justifyContent: "center", padding: "5rem 0" }}>
      <div style={{ color: "#5F6B5A", fontSize: 14 }}>Loading community...</div>
    </div>
  );
  if (error && !community) return (
    <div style={{ padding: "2rem", color: "#E63946", fontSize: 14 }}>{error}</div>
  );
  if (!community) return null;

  const sc = statusColor(community.status);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "#5F6B5A", textDecoration: "none" }}>← All communities</a>

      {/* Header */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 4 }}>
          <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", color: "#1A1A18", margin: 0 }}>{community.name}</h1>
          <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 999, color: sc.color, background: sc.bg, flexShrink: 0 }}>{community.status}</span>
        </div>
        <p style={{ color: "#5F6B5A", fontSize: 14, margin: "0 0 4px", lineHeight: 1.5 }}>{community.description}</p>
        <div style={{ fontSize: 12, color: "#8A9985" }}>Founded by <span style={{ color: "#5F6B5A" }}>{community.founder_name}</span></div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {[
          { label: "Pot", value: formatGEN(community.pot_balance) },
          { label: "Members", value: String(community.member_count) },
          { label: "Funded", value: String(community.funded_count) },
          { label: "Completed", value: String(community.completed_count) },
        ].map(({ label, value }) => (
          <div key={label} style={{ ...s.card, textAlign: "center", padding: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#2D6A4F" }}>{value}</div>
            <div style={{ fontSize: 11, color: "#8A9985" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Community ID */}
      <div style={{ ...s.cardGreen, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#5F6B5A", marginBottom: 2 }}>Community ID — share to invite members</div>
          <div style={{ fontFamily: "monospace", fontWeight: 600, color: "#2D6A4F", fontSize: 20, letterSpacing: "0.1em" }}>{communityId}</div>
        </div>
        <button onClick={copyId} style={{ ...s.btnSecondary, flexShrink: 0 }}>{copied ? "Copied!" : "Copy"}</button>
      </div>

      {/* Join */}
      {wallet.connected && !isMember && (
        <div style={s.card}>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#1A1A18", marginBottom: 12 }}>Join this community</div>
          {showJoinForm ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input style={s.input} placeholder="Your display name" value={memberName} onChange={e => setMemberName(e.target.value)} maxLength={30} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleJoin} disabled={!memberName.trim() || txLoading === "join"} style={{ ...s.btnPrimary, flex: 1 }}>
                  {txLoading === "join" ? "Joining..." : "Confirm join →"}
                </button>
                <button onClick={() => setShowJoinForm(false)} style={{ ...s.btnSecondary }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowJoinForm(true)} style={s.btnPrimary}>Join community →</button>
          )}
        </div>
      )}

      {community.status === "depleted" && (
        <div style={{ padding: 14, background: "rgba(230,57,70,0.05)", border: "1px solid rgba(230,57,70,0.2)", borderRadius: 12, fontSize: 13, color: "#E63946" }}>
          The pot is depleted. Deposit funds to re-activate proposal submissions.
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(0,0,0,0.08)", gap: 24 }}>
        {(["proposals", "constitution", "treasury"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            paddingBottom: 10, fontSize: 14, fontWeight: tab === t ? 500 : 400,
            color: tab === t ? "#2D6A4F" : "#5F6B5A",
            border: "none", borderBottom: tab === t ? "2px solid #2D6A4F" : "2px solid transparent",
            background: "transparent", cursor: "pointer", fontFamily: "inherit",
            textTransform: "capitalize", marginBottom: -1
          }}>
            {t}
          </button>
        ))}
      </div>

      {/* Proposals tab */}
      {tab === "proposals" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, color: "#8A9985" }}>{proposals.length} proposal{proposals.length !== 1 ? "s" : ""}</div>
            {isMember && community.status === "active" && (
              <Link href={`/community/${communityId}/propose`} style={{ fontSize: 13, fontWeight: 500, color: "#2D6A4F", textDecoration: "none" }}>+ Submit proposal</Link>
            )}
          </div>
          {proposals.length === 0 ? (
            <div style={{ ...s.card, textAlign: "center", color: "#8A9985", fontSize: 14, padding: "2rem" }}>
              No proposals yet.{isMember ? " Be the first to submit one." : " Join to submit a proposal."}
            </div>
          ) : (
            proposals.map(p => {
              const isOwn = p.proposer.toLowerCase() === wallet.address?.toLowerCase();
              const ps = proposalStatusColor(p.status);
              return (
                <Link key={p.id} href={`/proposal/${p.id}`} style={{ textDecoration: "none" }}>
                  <div style={{ ...s.card, cursor: "pointer", borderColor: isOwn ? "rgba(45,106,79,0.2)" : "rgba(0,0,0,0.08)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 500, color: "#1A1A18", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.title}
                          {isOwn && <span style={{ fontSize: 11, color: "#2D6A4F", marginLeft: 8 }}>(yours)</span>}
                          {p.is_revision && <span style={{ fontSize: 11, color: "#8A9985", marginLeft: 8 }}>↩ revision</span>}
                        </div>
                        <div style={{ fontSize: 12, color: "#5F6B5A", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>{p.what_it_does}</div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 500, padding: "2px 8px", borderRadius: 999, color: ps.color, background: ps.bg }}>{statusLabel(p.status)}</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#2D6A4F" }}>{formatGEN(p.amount)}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#8A9985" }}>
                      <span>by {p.proposer_name || p.proposer.slice(0,8)+"…"}</span>
                      <span>❤️ {p.pulse_count}</span>
                      {p.total_score !== null && <span style={{ color: p.total_score >= community.funding_threshold ? "#2D6A4F" : p.total_score >= 50 ? "#F4A261" : "#E63946", fontWeight: 600 }}>{p.total_score}/100</span>}
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      )}

      {/* Constitution tab */}
      {tab === "constitution" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ ...s.cardGreen, fontSize: 13, color: "#5F6B5A", lineHeight: 1.5 }}>
            The AI reads these five sentences before scoring every proposal. They are permanent and cannot be changed.
          </div>
          {[
            { tag: "🎯 Purpose", key: "purpose" },
            { tag: "✅ We always fund", key: "always_fund" },
            { tag: "🚫 We never fund", key: "never_fund" },
            { tag: "👥 Who benefits", key: "who_benefits" },
            { tag: "🏆 Success looks like", key: "success_looks_like" },
          ].map(({ tag, key }) => (
            <div key={key} style={s.card}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#2D6A4F", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{tag}</div>
              <div style={{ fontSize: 14, color: "#1A1A18", lineHeight: 1.6 }}>
                {community.constitution[key as keyof typeof community.constitution]}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Treasury tab */}
      {tab === "treasury" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ ...s.cardGreen, textAlign: "center", padding: "1.5rem" }}>
            <div style={{ fontSize: 32, fontWeight: 700, color: "#2D6A4F" }}>{formatGEN(community.pot_balance)}</div>
            <div style={{ fontSize: 12, color: "#5F6B5A", marginTop: 4 }}>Current pot balance</div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {[
              { label: "Total funded", value: formatGEN(community.total_funded) },
              { label: "Threshold", value: `${community.funding_threshold}/100` },
              { label: "Upfront %", value: `${community.upfront_release_pct}%` },
            ].map(({ label, value }) => (
              <div key={label} style={{ ...s.card, textAlign: "center", padding: 12 }}>
                <div style={{ fontWeight: 600, color: "#1A1A18" }}>{value}</div>
                <div style={{ fontSize: 11, color: "#8A9985" }}>{label}</div>
              </div>
            ))}
          </div>

          {wallet.connected && (
            <div style={s.card}>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#1A1A18", marginBottom: 8 }}>Deposit funds</div>
              <div style={{ fontSize: 12, color: "#8A9985", marginBottom: 12 }}>Anyone can deposit. Funds go directly into the community pot.</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="number" style={{ ...s.input, flex: 1 }} placeholder="Amount in GEN (e.g. 2.5)" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} min="0.001" step="0.1" />
                <button onClick={handleDeposit} disabled={!depositAmount || txLoading === "deposit"} style={{ ...s.btnPrimary, width: "auto", padding: "12px 20px" }}>
                  {txLoading === "deposit" ? "..." : "Deposit →"}
                </button>
              </div>
            </div>
          )}

          <div style={s.card}>
            <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "#5F6B5A", marginBottom: 12 }}>Governance rules</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                ["Funding threshold", `${community.funding_threshold}/100`],
                ["Max proposal", `${community.max_proposal_pct}% of pot`],
                ["Proposal fee", formatGEN(community.proposal_fee)],
                ["Upfront release", `${community.upfront_release_pct}% on approval`],
                ["Escrow", `${100 - community.upfront_release_pct}% after delivery`],
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
        </div>
      )}

      {error && <div style={{ padding: 14, background: "rgba(230,57,70,0.05)", border: "1px solid rgba(230,57,70,0.2)", borderRadius: 12, color: "#E63946", fontSize: 13 }}>{error}</div>}
    </div>
  );
}