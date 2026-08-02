"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCommunity, submitProposal, evaluateProposal } from "@/lib/contract";
import { fromRawUnits, toRawUnits, formatGEN, formatGENShort } from "@/lib/utils";
import type { Community } from "@/lib/types";
import { useWallet } from "@/app/components/wallet/WalletProvider";
import { Spinner, ErrorMessage, BackButton } from "@/app/components/ui/index";

export default function ProposePage() {
  const params = useParams();
  const communityId = (params?.id as string)?.toUpperCase();
  const router = useRouter();
  const { wallet, account } = useWallet();

  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState("");
  const [constitutionOpen, setConstitutionOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [amountGEN, setAmountGEN] = useState("");
  const [whatItDoes, setWhatItDoes] = useState("");
  const [whoItHelps, setWhoItHelps] = useState("");
  const [successMetric, setSuccessMetric] = useState("");
  const [timeline, setTimeline] = useState("");

  useEffect(() => {
    getCommunity(communityId)
      .then(c => { if (!(c as any).error) setCommunity(c); })
      .catch(() => setError("Community not found."))
      .finally(() => setPageLoading(false));
  }, [communityId]);

  if (pageLoading) return <div className="flex justify-center py-20"><Spinner className="text-forest w-6 h-6" /></div>;
  if (!community) return <div className="pt-8"><ErrorMessage message={error || "Community not found."} /></div>;

  const feeGEN = fromRawUnits(community.proposal_fee);
  const maxGEN = fromRawUnits(community.pot_balance) * community.max_proposal_pct / 100;
  const amountNum = parseFloat(amountGEN) || 0;
  const amountValid = amountNum > 0 && amountNum <= maxGEN;
  const upfrontGEN = amountNum * community.upfront_release_pct / 100;
  const escrowGEN = amountNum - upfrontGEN;

  const canSubmit = title.trim() && amountValid && whatItDoes.trim() && whoItHelps.trim() && successMetric.trim() && timeline.trim() && wallet.connected && !loading;

  async function handleSubmit() {
    if (!account || !community) return;
    setLoading(true);
    setError("");
    try {
      const proposalId = await submitProposal(account, {
        communityId,
        proposerName: wallet.address,
        title: title.trim(),
        amountRaw: toRawUnits(amountNum),
        whatItDoes: whatItDoes.trim(),
        whoItHelps: whoItHelps.trim(),
        successMetric: successMetric.trim(),
        timeline: timeline.trim(),
        feeRaw: toRawUnits(feeGEN),
      });
      if (!proposalId) throw new Error("No proposal ID returned");
      // Kick off evaluation in background
      evaluateProposal(account, proposalId).catch(console.error);
      router.push(`/proposal/${proposalId}`);
    } catch (e: any) {
      setError(e?.message || "Failed to submit proposal.");
      setLoading(false);
    }
  }

  return (
    <div className="cp-fade flex flex-col gap-6">
      <BackButton href={`/community/${communityId}`} label={community.name} />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink dark:text-cream">Submit a proposal</h1>
        <p className="text-sm text-stone dark:text-fog mt-1">
          Pot: <span className="text-forest dark:text-sage font-medium">{formatGENShort(community.pot_balance)}</span>
          {" · "}Max: <span className="font-medium text-ink dark:text-cream">{maxGEN.toFixed(2)} GEN</span>
          {" · "}Fee: <span className="font-medium text-ink dark:text-cream">{feeGEN} GEN</span>
        </p>
      </div>

      {/* Constitution accordion */}
      <div className="border border-forest/20 rounded-xl overflow-hidden">
        <button
          onClick={() => setConstitutionOpen(!constitutionOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-mint/20 dark:bg-forest/10 text-sm font-medium text-forest dark:text-sage"
        >
          <span>⚖️ Read the constitution before proposing</span>
          <span>{constitutionOpen ? "▲" : "▼"}</span>
        </button>
        {constitutionOpen && (
          <div className="p-4 flex flex-col gap-3 border-t border-forest/10">
            {[
              { tag: "PURPOSE", text: community.constitution.purpose },
              { tag: "ALWAYS FUND", text: community.constitution.always_fund },
              { tag: "NEVER FUND", text: community.constitution.never_fund },
              { tag: "WHO BENEFITS", text: community.constitution.who_benefits },
              { tag: "SUCCESS", text: community.constitution.success_looks_like },
            ].map(({ tag, text }) => (
              <div key={tag}>
                <div className="text-xs font-semibold text-forest dark:text-sage mb-0.5">{tag}</div>
                <div className="text-sm text-stone dark:text-fog leading-relaxed">{text}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form */}
      <div className="flex flex-col gap-4">
        <div>
          <label className="cp-label">Title</label>
          <input className="cp-input" placeholder="Short and specific — e.g. Open Source Solidity Toolkit for WAFR Devs" value={title} onChange={e => setTitle(e.target.value)} maxLength={80} />
        </div>

        <div>
          <label className="cp-label">
            Amount requested (GEN)
            {amountNum > 0 && (
              <span className={`ml-2 normal-case ${amountValid ? "text-forest dark:text-sage" : "text-coral"}`}>
                {amountValid ? `✓ within limit` : `✗ max is ${maxGEN.toFixed(2)} GEN`}
              </span>
            )}
          </label>
          <input
            type="number"
            className="cp-input"
            placeholder={`Max ${maxGEN.toFixed(2)} GEN`}
            value={amountGEN}
            onChange={e => setAmountGEN(e.target.value)}
            min={0.001}
            max={maxGEN}
            step={0.1}
          />
          {amountNum > 0 && amountValid && (
            <div className="text-xs text-stone dark:text-fog mt-1 flex gap-3">
              <span>Upfront on approval: <span className="text-forest dark:text-sage font-medium">{upfrontGEN.toFixed(3)} GEN ({community.upfront_release_pct}%)</span></span>
              <span>Held in escrow: <span className="font-medium">{escrowGEN.toFixed(3)} GEN</span></span>
            </div>
          )}
        </div>

        <div>
          <label className="cp-label">What it does</label>
          <textarea className="cp-textarea" rows={3} placeholder="Describe exactly what will be built or delivered. Be specific — vague proposals score low on feasibility." value={whatItDoes} onChange={e => setWhatItDoes(e.target.value)} maxLength={500} />
        </div>

        <div>
          <label className="cp-label">Who it helps</label>
          <textarea className="cp-textarea" rows={2} placeholder="Name specific member groups or roles who directly benefit." value={whoItHelps} onChange={e => setWhoItHelps(e.target.value)} maxLength={300} />
        </div>

        <div>
          <label className="cp-label">Success metric</label>
          <input className="cp-input" placeholder="e.g. 50 developers install and use the tool within 30 days of launch" value={successMetric} onChange={e => setSuccessMetric(e.target.value)} maxLength={200} />
        </div>

        <div>
          <label className="cp-label">Timeline</label>
          <input className="cp-input" placeholder="e.g. 6 weeks — v1 delivered by end of month 2" value={timeline} onChange={e => setTimeline(e.target.value)} maxLength={200} />
        </div>
      </div>

      {/* AI scoring reminder */}
      <div className="cp-card text-sm text-stone dark:text-fog leading-relaxed">
        <span className="font-medium text-ink dark:text-cream">AI scores your proposal</span> across five dimensions: purpose alignment, community benefit, constitutional fit, feasibility, and value for money. Score ≥{community.funding_threshold} gets funded. 50–{community.funding_threshold - 1} enters revision. Below 50 is rejected.
      </div>

      <ErrorMessage message={error} />

      <button onClick={handleSubmit} disabled={!canSubmit} className="cp-btn-primary">
        {loading ? (
          <span className="flex items-center gap-2 justify-center"><Spinner />Submitting proposal...</span>
        ) : `Submit proposal — pay ${feeGEN} GEN fee →`}
      </button>

      {!wallet.connected && (
        <div className="text-xs text-center text-coral">Connect a wallet to submit a proposal.</div>
      )}
    </div>
  );
}
