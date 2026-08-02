"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getProposal, getCommunity, getCommunityMembers,
  addPulse, evaluateProposal, submitCompletionEvidence,
  retryPayout, reviseProposal
} from "@/lib/contract";
import {
  formatGEN, formatGENShort, toRawUnits, scoreColor,
  statusLabel, statusColor, statusBg, EVIDENCE_TYPES
} from "@/lib/utils";
import type { Proposal, Community, EvidenceType } from "@/lib/types";
import { useWallet } from "../../components/wallet/WalletProvider";
import { Spinner, StatusBadge, ErrorMessage, BackButton, ScoreBar, LoadingDots } from "../../components/ui/index";

const PRINCIPLE_LABELS: Record<string, string> = {
  purpose_alignment:  "Purpose alignment",
  community_benefit:  "Community benefit",
  constitutional_fit: "Constitutional fit",
  feasibility:        "Feasibility",
  value_for_money:    "Value for money",
};

const POLL_INTERVAL = 4000;

export default function ProposalPage() {
  const params = useParams();
  const proposalId = (params?.id as string)?.toUpperCase();
  const { wallet, account } = useWallet();

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [txLoading, setTxLoading] = useState("");
  const [error, setError] = useState("");
  const [localPulsed, setLocalPulsed] = useState(false);

  // Evidence form state
  const [evidenceType, setEvidenceType] = useState<EvidenceType>("github_repo");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceDesc, setEvidenceDesc] = useState("");

  // Revision form state
  const [showReviseForm, setShowReviseForm] = useState(false);
  const [revTitle, setRevTitle] = useState("");
  const [revAmount, setRevAmount] = useState("");
  const [revWhat, setRevWhat] = useState("");
  const [revWho, setRevWho] = useState("");
  const [revMetric, setRevMetric] = useState("");
  const [revTimeline, setRevTimeline] = useState("");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!proposalId) return;
    try {
      const p = await getProposal(proposalId);
      if ((p as any).error) { setError("Proposal not found."); setLoading(false); return; }
      setProposal(p);
      const [c, m] = await Promise.all([
        getCommunity(p.community_id),
        getCommunityMembers(p.community_id),
      ]);
      setCommunity(c);
      setMembers(m.map((a: string) => a.toLowerCase()));
    } catch {
      setError("Failed to load proposal.");
    } finally {
      setLoading(false);
    }
  }, [proposalId]);

  useEffect(() => { load(); }, [load]);

  // Poll while pending or scoring
  useEffect(() => {
    if (!proposal) return;
    if (proposal.status === "pending" || proposal.status === "scoring") {
      pollRef.current = setInterval(async () => {
        try {
          const p = await getProposal(proposalId);
          setProposal(p);
          if (p.status !== "pending" && p.status !== "scoring") {
            if (pollRef.current) clearInterval(pollRef.current);
          }
        } catch { /* keep polling */ }
      }, POLL_INTERVAL);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [proposal?.status, proposalId]);

  const isOwn = wallet.address && proposal?.proposer.toLowerCase() === wallet.address.toLowerCase();
  const isMember = wallet.address && members.includes(wallet.address.toLowerCase());
  const hasPulsed = localPulsed;
  const canPulse = isMember && !hasPulsed && proposal && ["pending", "scoring"].includes(proposal.status);

  async function handlePulse() {
    if (!account || !proposal) return;
    setTxLoading("pulse");
    setError("");
    try {
      await addPulse(account, proposalId);
      setLocalPulsed(true);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to add pulse.");
    } finally {
      setTxLoading("");
    }
  }

  async function handleEvaluate() {
    if (!account || !proposal) return;
    setTxLoading("evaluate");
    setError("");
    try {
      await evaluateProposal(account, proposalId);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to trigger evaluation.");
    } finally {
      setTxLoading("");
    }
  }

  async function handleRetryPayout() {
    if (!account) return;
    setTxLoading("retry");
    setError("");
    try {
      await retryPayout(account, proposalId);
      await load();
    } catch (e: any) {
      setError(e?.message || "Retry payout failed.");
    } finally {
      setTxLoading("");
    }
  }

  async function handleSubmitEvidence() {
    if (!account || !evidenceUrl.trim()) return;
    setTxLoading("evidence");
    setError("");
    try {
      await submitCompletionEvidence(account, {
        proposalId,
        evidenceType,
        evidenceUrl: evidenceUrl.trim(),
        evidenceDescription: evidenceDesc.trim(),
      });
      await load();
    } catch (e: any) {
      setError(e?.message || "Evidence submission failed.");
    } finally {
      setTxLoading("");
    }
  }

  async function handleRevise() {
    if (!account || !proposal) return;
    if (!revTitle.trim() || !revAmount || !revWhat.trim() || !revWho.trim() || !revMetric.trim() || !revTimeline.trim()) {
      setError("All fields are required for revision.");
      return;
    }
    setTxLoading("revise");
    setError("");
    try {
      const newId = await reviseProposal(account, {
        originalProposalId: proposalId,
        title: revTitle.trim(),
        amountRaw: toRawUnits(parseFloat(revAmount)),
        whatItDoes: revWhat.trim(),
        whoItHelps: revWho.trim(),
        successMetric: revMetric.trim(),
        timeline: revTimeline.trim(),
      });
      if (!newId) throw new Error("No proposal ID returned");
      evaluateProposal(account, newId).catch(console.error);
      window.location.href = `/proposal/${newId}`;
    } catch (e: any) {
      setError(e?.message || "Revision failed.");
      setTxLoading("");
    }
  }

  if (loading) return <div className="flex justify-center py-20"><Spinner className="text-forest w-6 h-6" /></div>;
  if (error && !proposal) return <div className="pt-8"><ErrorMessage message={error} /></div>;
  if (!proposal || !community) return null;

  const isEvaluating = proposal.status === "pending" || proposal.status === "scoring";
  const isScored = proposal.total_score !== null;
  const fundingThreshold = community.funding_threshold;

  const selectedEvType = EVIDENCE_TYPES.find(t => t.value === evidenceType);

  return (
    <div className="cp-fade flex flex-col gap-6">
      <BackButton href={`/community/${proposal.community_id}`} label={community.name} />

      {/* ── Status + title ── */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge
            label={statusLabel(proposal.status)}
            color={statusColor(proposal.status)}
            bg={statusBg(proposal.status)}
          />
          {proposal.is_revision && (
            <span className="text-xs text-stone dark:text-fog">
              ↩ Revision of{" "}
              <Link href={`/proposal/${proposal.original_proposal_id}`} className="text-forest dark:text-sage hover:underline">
                {proposal.original_proposal_id}
              </Link>
            </span>
          )}
          {isOwn && <span className="text-xs text-forest dark:text-sage font-medium">Your proposal</span>}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink dark:text-cream leading-tight">
          {proposal.title}
        </h1>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-bold text-2xl text-forest dark:text-sage">{formatGENShort(proposal.amount)}</span>
          <span className="text-stone dark:text-fog">requested</span>
        </div>
      </div>

      {/* ── Proposal body ── */}
      <div className="cp-card flex flex-col gap-4">
        {[
          { label: "What it does", text: proposal.what_it_does },
          { label: "Who it helps", text: proposal.who_it_helps },
          { label: "Success metric", text: proposal.success_metric },
          { label: "Timeline", text: proposal.timeline },
        ].map(({ label, text }) => (
          <div key={label}>
            <div className="cp-section-label mb-1">{label}</div>
            <div className="text-sm text-ink dark:text-cream leading-relaxed">{text}</div>
          </div>
        ))}
        <div className="pt-2 border-t border-black/6 dark:border-white/6 text-xs text-stone dark:text-fog flex gap-3">
          <span>By <span className="font-medium">{proposal.proposer_name || proposal.proposer.slice(0, 8) + "…"}</span></span>
          <span className="font-mono">{proposal.id}</span>
        </div>
      </div>

      {/* ── Evaluating state ── */}
      {isEvaluating && (
        <div className="cp-card border-forest/20 bg-mint/10 dark:bg-forest/10 text-center py-6 flex flex-col gap-3 items-center">
          <LoadingDots />
          <div className="text-sm font-medium text-forest dark:text-sage">
            {proposal.status === "pending" ? "Awaiting evaluation" : "AI is evaluating this proposal..."}
          </div>
          <div className="text-xs text-stone dark:text-fog max-w-xs leading-relaxed">
            Multiple GenLayer validators score independently and must reach consensus. This takes 3–5 minutes.
          </div>
          {proposal.status === "pending" && isMember && (
            <button onClick={handleEvaluate} disabled={txLoading === "evaluate"} className="cp-btn-secondary w-auto px-5 mt-2">
              {txLoading === "evaluate" ? <span className="flex items-center gap-2"><Spinner />Triggering...</span> : "Trigger evaluation →"}
            </button>
          )}
        </div>
      )}

      {/* ── Score breakdown ── */}
      {isScored && (
        <div className="cp-card flex flex-col gap-4">
          <div className="cp-section-label">AI evaluation</div>

          {/* Score summary */}
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold" style={{ color: scoreColor(proposal.total_score!) }}>
              {proposal.total_score}
            </span>
            <span className="text-stone dark:text-fog text-sm">/100</span>
            <span className="text-xs text-stone dark:text-fog ml-2">
              Base {proposal.base_score} + Pulse {proposal.pulse_bonus}
            </span>
          </div>

          {/* Threshold bar */}
          <div className="relative">
            <div className="h-2 rounded-full bg-black/8 dark:bg-white/8 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(proposal.total_score!, 100)}%`,
                  backgroundColor: scoreColor(proposal.total_score!),
                }}
              />
            </div>
            {/* Threshold marker */}
            <div
              className="absolute top-0 w-0.5 h-2 bg-ink dark:bg-cream opacity-40"
              style={{ left: `${fundingThreshold}%` }}
              title={`Threshold: ${fundingThreshold}`}
            />
            <div className="flex justify-between text-xs text-stone dark:text-fog mt-1">
              <span>0</span>
              <span>Threshold: {fundingThreshold}</span>
              <span>100</span>
            </div>
          </div>

          {/* Principle scores */}
          <div className="flex flex-col gap-2.5">
            {Object.entries(PRINCIPLE_LABELS).map(([key, label]) => (
              <ScoreBar
                key={key}
                label={label}
                score={proposal.principle_scores[key as keyof typeof proposal.principle_scores]}
              />
            ))}
          </div>

          {/* Reasoning */}
          {proposal.reasoning && (
            <div>
              <div className="cp-section-label mb-1">Reasoning</div>
              <div className="text-sm text-stone dark:text-fog leading-relaxed italic">
                "{proposal.reasoning}"
              </div>
            </div>
          )}

          {/* Concerns */}
          {proposal.concerns && (proposal.status === "revision" || proposal.status === "rejected") && (
            <div className="cp-card-amber">
              <div className="cp-section-label mb-1">Concerns</div>
              <div className="text-sm text-stone dark:text-fog leading-relaxed">{proposal.concerns}</div>
            </div>
          )}
        </div>
      )}

      {/* ── Pulse section ── */}
      <div className="cp-card flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="cp-section-label">Community pulse</div>
          <div className="text-sm font-semibold text-forest dark:text-sage">
            ❤️ {proposal.pulse_count} {proposal.pulse_count === 1 ? "member" : "members"}
          </div>
        </div>
        <div className="text-xs text-stone dark:text-fog">
          Pulse signals add up to <span className="font-medium text-ink dark:text-cream">+5 bonus points</span> on the AI score. One pulse per member. Not token-weighted.
        </div>
        {hasPulsed ? (
          <div className="text-sm text-forest dark:text-sage font-medium">✓ You supported this proposal</div>
        ) : canPulse ? (
          <button onClick={handlePulse} disabled={txLoading === "pulse"} className="cp-btn-secondary">
            {txLoading === "pulse" ? <span className="flex items-center gap-2 justify-center"><Spinner />Adding pulse...</span> : "❤️ Add your pulse"}
          </button>
        ) : !isMember ? (
          <div className="text-xs text-stone dark:text-fog">Join this community to add your pulse.</div>
        ) : (
          <div className="text-xs text-stone dark:text-fog">Pulsing is only available while the proposal is pending.</div>
        )}
      </div>

      {/* ── Escrow status (funded_partial) ── */}
      {(proposal.status === "funded_partial" || proposal.status === "completed" || proposal.status === "completion_failed") && (
        <div className="cp-card-green flex flex-col gap-3">
          <div className="cp-section-label">Escrow status</div>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-stone dark:text-fog">Upfront paid</span>
              <span className="font-semibold text-forest dark:text-sage">{formatGEN(proposal.upfront_paid)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone dark:text-fog">Held in escrow</span>
              <span className="font-semibold text-ink dark:text-cream">{formatGEN(proposal.escrowed_amount)}</span>
            </div>
            {proposal.completion_reasoning && (
              <div className="pt-2 border-t border-forest/10 text-xs text-stone dark:text-fog leading-relaxed italic">
                AI verification: "{proposal.completion_reasoning}"
              </div>
            )}
            {proposal.completion_resubmission_count === 1 && proposal.status === "funded_partial" && (
              <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                ⚠️ First evidence submission did not pass. You have one more attempt.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Completion failed ── */}
      {proposal.status === "completion_failed" && (
        <div className="cp-card-red text-sm text-coral">
          Both evidence submissions failed verification. The escrowed funds have been returned to the community pot.
        </div>
      )}

      {/* ── Approved unfunded ── */}
      {proposal.status === "approved_unfunded" && (
        <div className="cp-card-amber flex flex-col gap-3">
          <div className="text-sm font-medium text-ink dark:text-cream">Approved — pot was low at the time</div>
          <div className="text-sm text-stone dark:text-fog">
            This proposal scored above the threshold but the pot didn't have enough to cover the upfront payment. Once the community deposits more funds, anyone can retry the payout.
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-stone dark:text-fog">Upfront needed</span>
            <span className="font-semibold">{formatGEN(proposal.upfront_amount)}</span>
          </div>
          <button onClick={handleRetryPayout} disabled={txLoading === "retry"} className="cp-btn-primary">
            {txLoading === "retry" ? <span className="flex items-center gap-2 justify-center"><Spinner />Retrying...</span> : "Retry payout →"}
          </button>
        </div>
      )}

      {/* ── Evidence submission (proposer only, funded_partial) ── */}
      {proposal.status === "funded_partial" && isOwn && (
        <div className="cp-card flex flex-col gap-4">
          <div>
            <div className="cp-section-label mb-1">Submit delivery evidence</div>
            <div className="text-xs text-stone dark:text-fog leading-relaxed">
              The AI will live-fetch your URL and verify the content matches what you promised. If it passes, the escrowed <span className="font-medium text-ink dark:text-cream">{formatGEN(proposal.escrowed_amount)}</span> is released to you.
            </div>
          </div>

          {/* Evidence type */}
          <div>
            <label className="cp-label">Evidence type</label>
            <div className="grid grid-cols-2 gap-2">
              {EVIDENCE_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => { setEvidenceType(t.value as EvidenceType); setEvidenceUrl(""); }}
                  className={`px-3 py-2.5 rounded-xl border text-left text-xs transition-all ${
                    evidenceType === t.value
                      ? "border-forest bg-mint/30 dark:bg-forest/20 text-forest dark:text-sage font-medium"
                      : "border-black/10 dark:border-white/10 text-stone dark:text-fog hover:border-forest/30"
                  }`}
                >
                  <div className="font-medium mb-0.5">{t.label}</div>
                  <div className="text-stone/60 dark:text-fog/60 text-xs leading-tight">{t.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* URL */}
          <div>
            <label className="cp-label">Evidence URL</label>
            <input
              className="cp-input font-mono text-xs"
              placeholder={selectedEvType?.hint}
              value={evidenceUrl}
              onChange={e => setEvidenceUrl(e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className="cp-label">What you built — describe your delivery</label>
            <textarea
              className="cp-textarea"
              rows={3}
              placeholder="Tell the AI what it should find at the URL and how it matches what was promised..."
              value={evidenceDesc}
              onChange={e => setEvidenceDesc(e.target.value)}
              maxLength={800}
            />
          </div>

          <ErrorMessage message={error} />

          <button
            onClick={handleSubmitEvidence}
            disabled={!evidenceUrl.trim() || !evidenceDesc.trim() || txLoading === "evidence"}
            className="cp-btn-primary"
          >
            {txLoading === "evidence"
              ? <span className="flex items-center gap-2 justify-center"><Spinner />Verifying delivery...</span>
              : `Submit evidence — release ${formatGEN(proposal.escrowed_amount)} →`}
          </button>
        </div>
      )}

      {/* ── Revision section ── */}
      {proposal.status === "revision" && isOwn && proposal.revision_count === 0 && (
        <div className="cp-card-amber flex flex-col gap-3">
          <div className="text-sm font-medium text-ink dark:text-cream">🔄 This proposal needs revision</div>
          <div className="text-sm text-stone dark:text-fog leading-relaxed">
            The AI flagged concerns. You have one chance to revise and resubmit. Address the concerns above before revising.
          </div>

          {!showReviseForm ? (
            <button onClick={() => {
              setShowReviseForm(true);
              setRevTitle(proposal.title);
              setRevAmount(String(proposal.amount / 1e18));
              setRevWhat(proposal.what_it_does);
              setRevWho(proposal.who_it_helps);
              setRevMetric(proposal.success_metric);
              setRevTimeline(proposal.timeline);
            }} className="cp-btn-primary">
              Revise and resubmit →
            </button>
          ) : (
            <div className="flex flex-col gap-3 mt-2">
              <div>
                <label className="cp-label">Title</label>
                <input className="cp-input" value={revTitle} onChange={e => setRevTitle(e.target.value)} maxLength={80} />
              </div>
              <div>
                <label className="cp-label">Amount (GEN)</label>
                <input type="number" className="cp-input" value={revAmount} onChange={e => setRevAmount(e.target.value)} step={0.1} />
              </div>
              <div>
                <label className="cp-label">What it does</label>
                <textarea className="cp-textarea" rows={3} value={revWhat} onChange={e => setRevWhat(e.target.value)} maxLength={500} />
              </div>
              <div>
                <label className="cp-label">Who it helps</label>
                <textarea className="cp-textarea" rows={2} value={revWho} onChange={e => setRevWho(e.target.value)} maxLength={300} />
              </div>
              <div>
                <label className="cp-label">Success metric</label>
                <input className="cp-input" value={revMetric} onChange={e => setRevMetric(e.target.value)} maxLength={200} />
              </div>
              <div>
                <label className="cp-label">Timeline</label>
                <input className="cp-input" value={revTimeline} onChange={e => setRevTimeline(e.target.value)} maxLength={200} />
              </div>
              <ErrorMessage message={error} />
              <div className="flex gap-2">
                <button onClick={() => setShowReviseForm(false)} className="cp-btn-secondary" disabled={txLoading === "revise"}>Cancel</button>
                <button onClick={handleRevise} disabled={txLoading === "revise"} className="cp-btn-primary">
                  {txLoading === "revise" ? <span className="flex items-center gap-2 justify-center"><Spinner />Submitting...</span> : "Submit revision →"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Already revised */}
      {proposal.status === "revision" && isOwn && proposal.revision_count > 0 && (
        <div className="cp-card-red text-sm text-coral">
          This proposal has already used its one revision. No further revisions are allowed.
        </div>
      )}

      {/* Completed */}
      {proposal.status === "completed" && (
        <div className="cp-card-green text-center py-4">
          <div className="text-2xl mb-1">🎉</div>
          <div className="font-semibold text-forest dark:text-sage">Proposal completed</div>
          <div className="text-xs text-stone dark:text-fog mt-1">
            Full payout of {formatGEN(proposal.amount)} delivered. Delivery verified by AI.
          </div>
        </div>
      )}

      <ErrorMessage message={error} />
    </div>
  );
}
