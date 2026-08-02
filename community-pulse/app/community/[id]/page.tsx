"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getCommunity, getCommunityProposals, joinCommunity, depositFunds } from "@/lib/contract";
import { formatGEN, formatGENShort, fromRawUnits, toRawUnits, statusLabel, statusColor, statusBg, scoreColor } from "@/lib/utils";
import type { Community, Proposal } from "@/lib/types";
import { useWallet } from "../../../components/wallet/WalletProvider";
import { Spinner, StatusBadge, ErrorMessage, EmptyState, BackButton } from "../../components/ui/index";

type Tab = "proposals" | "constitution" | "treasury";
type FilterStatus = "all" | "pending" | "funded_partial" | "completed" | "revision" | "rejected";

export default function CommunityPage() {
  const params = useParams();
  const communityId = (params?.id as string)?.toUpperCase();
  const { wallet, account } = useWallet();

  const [community, setCommunity] = useState<Community | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [tab, setTab] = useState<Tab>("proposals");
  const [filter, setFilter] = useState<FilterStatus>("all");
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
      const [c, p] = await Promise.all([
        getCommunity(communityId),
        getCommunityProposals(communityId),
      ]);
      if ((c as any).error) { setError("Community not found."); return; }
      setCommunity(c);
      setProposals(p.sort((a: Proposal, b: Proposal) => b.created_at - a.created_at));
      if (wallet.address) {
        const { getCommunityMembers } = await import("@/lib/contract");
        const members = await getCommunityMembers(communityId);
        setIsMember(members.map((m: string) => m.toLowerCase()).includes(wallet.address.toLowerCase()));
      }
    } catch {
      setError("Failed to load community.");
    } finally {
      setLoading(false);
    }
  }, [communityId, wallet.address]);

  useEffect(() => { load(); }, [load]);

  async function handleJoin() {
    if (!account || !community || !memberName.trim()) return;
    setTxLoading("Joining community...");
    setError("");
    try {
      await joinCommunity(account, communityId, memberName.trim());
      setIsMember(true);
      setShowJoinForm(false);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to join. Try again.");
    } finally {
      setTxLoading("");
    }
  }

  async function handleDeposit() {
    if (!account || !community || !depositAmount) return;
    const gen = parseFloat(depositAmount);
    if (!gen || gen <= 0) return;
    setTxLoading("Depositing...");
    setError("");
    try {
      const raw = toRawUnits(gen);
      await depositFunds(account, communityId, raw);
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

  if (loading) return (
    <div className="flex justify-center py-20"><Spinner className="text-forest w-6 h-6" /></div>
  );
  if (error && !community) return (
    <div className="pt-8"><ErrorMessage message={error} /></div>
  );
  if (!community) return null;

  const maxProposal = fromRawUnits(community.pot_balance) * community.max_proposal_pct / 100;
  const filtered = filter === "all" ? proposals : proposals.filter(p => p.status === filter);

  const filterOptions: { value: FilterStatus; label: string }[] = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "funded_partial", label: "Funded" },
    { value: "completed", label: "Completed" },
    { value: "revision", label: "Revision" },
    { value: "rejected", label: "Rejected" },
  ];

  return (
    <div className="cp-fade flex flex-col gap-6">
      <BackButton href="/" label="All communities" />

      {/* ── Community header ── */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-1">
          <h1 className="text-2xl font-semibold tracking-tight text-ink dark:text-cream">{community.name}</h1>
          <StatusBadge label={community.status} color={statusColor(community.status)} bg={statusBg(community.status)} />
        </div>
        <p className="text-stone dark:text-fog text-sm leading-relaxed">{community.description}</p>
        <div className="text-xs text-stone/60 dark:text-fog/60 mt-1">
          Founded by <span className="text-stone dark:text-fog">{community.founder_name}</span>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Pot balance", value: formatGENShort(community.pot_balance) },
          { label: "Members", value: String(community.member_count) },
          { label: "Funded", value: String(community.funded_count) },
          { label: "Completed", value: String(community.completed_count) },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white dark:bg-white/4 border border-black/8 dark:border-white/8 rounded-xl p-3 text-center">
            <div className="text-lg font-semibold text-forest dark:text-sage">{value}</div>
            <div className="text-xs text-stone dark:text-fog">{label}</div>
          </div>
        ))}
      </div>

      {/* ── Community ID + share ── */}
      <div className="cp-card-green flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-stone dark:text-fog mb-0.5">Community ID — share to invite members</div>
          <div className="font-mono font-semibold text-forest dark:text-sage tracking-widest text-lg">{communityId}</div>
        </div>
        <button onClick={copyId} className="text-xs px-3 py-1.5 rounded-lg border border-forest/30 text-forest dark:text-sage hover:bg-mint/30 transition-colors">
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* ── Join / deposit actions ── */}
      {wallet.connected && !isMember && (
        <div className="cp-card">
          <div className="text-sm font-medium text-ink dark:text-cream mb-3">Join this community</div>
          {showJoinForm ? (
            <div className="flex flex-col gap-3">
              <input
                className="cp-input"
                placeholder="Your display name"
                value={memberName}
                onChange={e => setMemberName(e.target.value)}
                maxLength={30}
              />
              <div className="flex gap-2">
                <button onClick={handleJoin} disabled={!memberName.trim() || !!txLoading} className="cp-btn-primary">
                  {txLoading === "Joining community..." ? <span className="flex items-center gap-2 justify-center"><Spinner />Joining...</span> : "Confirm join →"}
                </button>
                <button onClick={() => setShowJoinForm(false)} className="cp-btn-ghost w-auto px-4">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowJoinForm(true)} className="cp-btn-primary">Join community →</button>
          )}
        </div>
      )}

      {/* ── Depleted warning ── */}
      {community.status === "depleted" && (
        <div className="cp-card-red text-sm text-coral">
          The pot is depleted. Deposit funds to re-activate proposal submissions.
        </div>
      )}

      {/* ── Tab nav ── */}
      <div className="flex border-b border-black/8 dark:border-white/8 gap-4">
        {(["proposals", "constitution", "treasury"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-forest text-forest dark:text-sage dark:border-sage"
                : "border-transparent text-stone dark:text-fog hover:text-ink dark:hover:text-cream"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Proposals tab ── */}
      {tab === "proposals" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {filterOptions.map(({ value, label }) => {
                const count = value === "all" ? proposals.length : proposals.filter(p => p.status === value).length;
                return (
                  <button
                    key={value}
                    onClick={() => setFilter(value)}
                    className={`text-xs px-3 py-1.5 rounded-full border whitespace-nowrap transition-colors ${
                      filter === value
                        ? "bg-mint/40 dark:bg-forest/20 border-forest/30 text-forest dark:text-sage font-medium"
                        : "border-black/8 dark:border-white/8 text-stone dark:text-fog hover:border-forest/20"
                    }`}
                  >
                    {label} {count > 0 && `(${count})`}
                  </button>
                );
              })}
            </div>
            {isMember && community.status === "active" && (
              <Link href={`/community/${communityId}/propose`} className="text-sm font-medium text-forest dark:text-sage hover:underline whitespace-nowrap">
                + Submit proposal
              </Link>
            )}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              message={filter === "all" ? "No proposals yet" : `No ${filter} proposals`}
              sub={isMember ? "Be the first to submit one." : "Join to submit a proposal."}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map(p => {
                const isOwn = p.proposer.toLowerCase() === wallet.address.toLowerCase();
                return (
                  <Link
                    key={p.id}
                    href={`/proposal/${p.id}`}
                    className={`cp-card hover:border-forest/30 dark:hover:border-forest/30 transition-all group ${isOwn ? "border-forest/20 dark:border-forest/20" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-ink dark:text-cream group-hover:text-forest dark:group-hover:text-sage transition-colors truncate">
                          {p.title}
                          {isOwn && <span className="ml-2 text-xs text-forest/60 dark:text-sage/60 font-normal">(yours)</span>}
                          {p.is_revision && <span className="ml-2 text-xs text-stone/50 dark:text-fog/50">↩ revision</span>}
                        </div>
                        <div className="text-xs text-stone dark:text-fog mt-0.5 line-clamp-2 leading-relaxed">{p.what_it_does}</div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <StatusBadge label={statusLabel(p.status)} color={statusColor(p.status)} bg={statusBg(p.status)} />
                        <span className="text-sm font-semibold text-forest dark:text-sage">{formatGENShort(p.amount)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-stone dark:text-fog">
                      <span>by {p.proposer_name}</span>
                      <span>❤️ {p.pulse_count}</span>
                      {p.total_score !== null && (
                        <span style={{ color: scoreColor(p.total_score) }} className="font-semibold">
                          {p.total_score}/100
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Constitution tab ── */}
      {tab === "constitution" && (
        <div className="flex flex-col gap-4">
          <div className="cp-card bg-mint/10 dark:bg-forest/10 border-forest/20 text-sm text-stone dark:text-fog">
            The AI reads these five sentences before scoring every proposal. They are permanent — the constitution cannot be changed after the community is created.
          </div>
          {[
            { tag: "PURPOSE", key: "purpose", icon: "🎯" },
            { tag: "WE ALWAYS FUND", key: "always_fund", icon: "✅" },
            { tag: "WE NEVER FUND", key: "never_fund", icon: "🚫" },
            { tag: "WHO BENEFITS", key: "who_benefits", icon: "👥" },
            { tag: "SUCCESS LOOKS LIKE", key: "success_looks_like", icon: "🏆" },
          ].map(({ tag, key, icon }) => (
            <div key={key} className="cp-card flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span>{icon}</span>
                <span className="text-xs font-semibold text-forest dark:text-sage uppercase tracking-wider">{tag}</span>
              </div>
              <div className="text-sm text-ink dark:text-cream leading-relaxed">
                {community.constitution[key as keyof typeof community.constitution]}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Treasury tab ── */}
      {tab === "treasury" && (
        <div className="flex flex-col gap-4">
          <div className="cp-card-green text-center py-4">
            <div className="text-3xl font-bold text-forest dark:text-sage">{formatGEN(community.pot_balance)}</div>
            <div className="text-xs text-stone dark:text-fog mt-1">Current pot balance</div>
            {community.status === "depleted" && (
              <div className="text-xs text-coral mt-2">Pot depleted — deposit to re-activate</div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total funded", value: formatGENShort(community.total_funded) },
              { label: "Threshold", value: `${community.funding_threshold}/100` },
              { label: "Upfront %", value: `${community.upfront_release_pct}%` },
            ].map(({ label, value }) => (
              <div key={label} className="cp-card text-center">
                <div className="font-semibold text-ink dark:text-cream">{value}</div>
                <div className="text-xs text-stone dark:text-fog">{label}</div>
              </div>
            ))}
          </div>

          {wallet.connected && (
            <div className="cp-card flex flex-col gap-3">
              <div className="text-sm font-medium text-ink dark:text-cream">Deposit funds</div>
              <div className="text-xs text-stone dark:text-fog">Anyone can deposit. Funds are permanent — they go directly into the community pot.</div>
              <div className="flex gap-2">
                <input
                  type="number"
                  className="cp-input flex-1"
                  placeholder="Amount in GEN (e.g. 2.5)"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  min="0.001"
                  step="0.1"
                />
                <button
                  onClick={handleDeposit}
                  disabled={!depositAmount || !!txLoading}
                  className="cp-btn-primary w-auto px-5"
                >
                  {txLoading === "Depositing..." ? <Spinner /> : "Deposit →"}
                </button>
              </div>
              {depositAmount && parseFloat(depositAmount) > 0 && (
                <div className="text-xs text-stone dark:text-fog">
                  New pot: <span className="text-forest dark:text-sage font-medium">{formatGEN(toRawUnits(parseFloat(depositAmount)) as unknown as number + community.pot_balance)}</span>
                </div>
              )}
            </div>
          )}

          <div className="cp-card flex flex-col gap-3">
            <div className="cp-section-label">Governance rules</div>
            {[
              ["Funding threshold", `${community.funding_threshold}/100 to be funded`],
              ["Max proposal size", `${community.max_proposal_pct}% of pot (max ${fromRawUnits(community.pot_balance) * community.max_proposal_pct / 100 > 0 ? formatGENShort(community.pot_balance * community.max_proposal_pct / 100) : "0 GEN"})`],
              ["Proposal fee", formatGEN(community.proposal_fee)],
              ["Upfront release", `${community.upfront_release_pct}% paid on approval`],
              ["Escrow release", `${100 - community.upfront_release_pct}% held until delivery verified`],
              ["Revision rounds", "1 per proposal"],
              ["Pulse bonus", "Up to +5 points"],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between items-start gap-4 text-sm">
                <span className="text-stone dark:text-fog">{label}</span>
                <span className="font-medium text-ink dark:text-cream text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <ErrorMessage message={error} />
    </div>
  );
}
