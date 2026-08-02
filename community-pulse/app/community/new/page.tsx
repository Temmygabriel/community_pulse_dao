"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCommunity } from "@/lib/contract";
import { toRawUnits } from "@/lib/utils";
import { useWallet } from "@/app/components/wallet/WalletProvider";
import { Spinner, ErrorMessage, BackButton } from "@/app/components/ui/index";

type Step = 1 | 2 | 3;

export default function CreateCommunityPage() {
  const router = useRouter();
  const { wallet, account } = useWallet();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1 — identity + community info
  const [founderName, setFounderName] = useState("");
  const [communityName, setCommunityName] = useState("");
  const [description, setDescription] = useState("");

  // Step 2 — constitution
  const [purpose, setPurpose] = useState("");
  const [alwaysFund, setAlwaysFund] = useState("");
  const [neverFund, setNeverFund] = useState("");
  const [whoBenefits, setWhoBenefits] = useState("");
  const [success, setSuccess] = useState("");

  // Step 3 — treasury settings
  const [startingPot, setStartingPot] = useState("5");
  const [fundingThreshold, setFundingThreshold] = useState(70);
  const [maxProposalPct, setMaxProposalPct] = useState(30);
  const [proposalFeeGEN, setProposalFeeGEN] = useState("1");
  const [upfrontReleasePct, setUpfrontReleasePct] = useState(50);

  const step1Valid = founderName.trim() && communityName.trim() && description.trim();
  const step2Valid = purpose.trim() && alwaysFund.trim() && neverFund.trim() && whoBenefits.trim() && success.trim();
  const step3Valid = parseFloat(startingPot) > 0 && parseFloat(proposalFeeGEN) >= 0;

  async function handleSubmit() {
    if (!account || !wallet.connected) {
      setError("Please connect a wallet first.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const communityId = await createCommunity(account, {
        founderName: founderName.trim(),
        communityName: communityName.trim(),
        description: description.trim(),
        constitutionPurpose: purpose.trim(),
        constitutionAlwaysFund: alwaysFund.trim(),
        constitutionNeverFund: neverFund.trim(),
        constitutionWhoBenefits: whoBenefits.trim(),
        constitutionSuccess: success.trim(),
        fundingThreshold,
        maxProposalPct,
        proposalFeeRaw: toRawUnits(parseFloat(proposalFeeGEN) || 0),
        upfrontReleasePct,
        startingPotRaw: toRawUnits(parseFloat(startingPot)),
      });
      if (!communityId) throw new Error("No community ID returned");
      router.push(`/community/${communityId}`);
    } catch (e: any) {
      setError(e?.message || "Failed to create community. Try again.");
      setLoading(false);
    }
  }

  const stepLabels = ["Identity", "Constitution", "Treasury"];

  return (
    <div className="cp-fade flex flex-col gap-6">
      <BackButton href="/" label="Back" />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink dark:text-cream">Found a community</h1>
        <p className="text-stone dark:text-fog text-sm mt-1">
          Write your constitution carefully — the AI will use it to judge every proposal forever.
        </p>
      </div>

      {/* ── Step progress ── */}
      <div className="flex gap-2">
        {stepLabels.map((label, i) => {
          const s = (i + 1) as Step;
          return (
            <div key={label} className="flex-1 flex flex-col gap-1">
              <div className={`h-1 rounded-full transition-colors ${s <= step ? "bg-forest" : "bg-black/10 dark:bg-white/10"}`} />
              <div className={`text-xs ${s === step ? "text-forest dark:text-sage font-medium" : "text-stone dark:text-fog"}`}>
                {label}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Step 1 ── */}
      {step === 1 && (
        <div className="flex flex-col gap-4 cp-fade">
          <div className="cp-card bg-mint/10 dark:bg-forest/10 border-forest/20 text-sm text-stone dark:text-fog">
            Your wallet address becomes the founder permanently. It cannot be changed.
          </div>

          {wallet.connected && (
            <div className="font-mono text-xs text-stone/60 dark:text-fog/60 bg-black/3 dark:bg-white/4 px-3 py-2 rounded-lg break-all">
              {wallet.address}
            </div>
          )}

          <div>
            <label className="cp-label">Your display name</label>
            <input className="cp-input" placeholder="How members will see you..." value={founderName} onChange={e => setFounderName(e.target.value)} maxLength={30} />
          </div>
          <div>
            <label className="cp-label">Community name</label>
            <input className="cp-input" placeholder="e.g. Lagos Dev Guild, Green Africa Fund..." value={communityName} onChange={e => setCommunityName(e.target.value)} maxLength={60} />
          </div>
          <div>
            <label className="cp-label">Description</label>
            <textarea className="cp-textarea" rows={3} placeholder="One paragraph — what is this community and who is it for?" value={description} onChange={e => setDescription(e.target.value)} maxLength={300} />
          </div>

          <button onClick={() => setStep(2)} disabled={!step1Valid} className="cp-btn-primary">
            Next — Write constitution →
          </button>
        </div>
      )}

      {/* ── Step 2 ── */}
      {step === 2 && (
        <div className="flex flex-col gap-4 cp-fade">
          <div className="cp-card bg-mint/10 dark:bg-forest/10 border-forest/20 text-sm text-stone dark:text-fog">
            ⚖️ The AI reads these five sentences before scoring every proposal. Be specific — vague constitutions produce inconsistent scores.
          </div>

          <div>
            <label className="cp-label">🎯 Purpose — what is this community for?</label>
            <textarea className="cp-textarea" rows={2} placeholder="e.g. We exist to fund open-source developer tools that make building on-chain faster and cheaper for African developers." value={purpose} onChange={e => setPurpose(e.target.value)} maxLength={300} />
          </div>
          <div>
            <label className="cp-label">✅ We always fund</label>
            <textarea className="cp-textarea" rows={2} placeholder="e.g. We always fund proposals that ship working code, reduce transaction costs, or improve developer education." value={alwaysFund} onChange={e => setAlwaysFund(e.target.value)} maxLength={300} />
          </div>
          <div>
            <label className="cp-label">🚫 We never fund</label>
            <textarea className="cp-textarea" rows={2} placeholder="e.g. We never fund marketing campaigns, token speculation, or anything that does not produce a tangible deliverable." value={neverFund} onChange={e => setNeverFund(e.target.value)} maxLength={300} />
          </div>
          <div>
            <label className="cp-label">👥 Who benefits</label>
            <textarea className="cp-textarea" rows={2} placeholder="e.g. Decisions should primarily benefit junior developers and first-time contributors." value={whoBenefits} onChange={e => setWhoBenefits(e.target.value)} maxLength={300} />
          </div>
          <div>
            <label className="cp-label">🏆 Success looks like</label>
            <textarea className="cp-textarea" rows={2} placeholder="e.g. Success means at least one funded project ships and is used by 10 or more community members within 60 days." value={success} onChange={e => setSuccess(e.target.value)} maxLength={300} />
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="cp-btn-secondary">← Back</button>
            <button onClick={() => setStep(3)} disabled={!step2Valid} className="cp-btn-primary">
              Next — Treasury settings →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3 ── */}
      {step === 3 && (
        <div className="flex flex-col gap-5 cp-fade">
          <div>
            <label className="cp-label">Starting pot (GEN)</label>
            <input type="number" className="cp-input" min="0.1" step="0.5" value={startingPot} onChange={e => setStartingPot(e.target.value)} />
            <div className="text-xs text-stone dark:text-fog mt-1">This is the real GEN you are depositing to start the treasury. It will be sent as the payable value.</div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="cp-label mb-0">Funding threshold</label>
              <span className="text-lg font-semibold text-forest dark:text-sage">{fundingThreshold}/100</span>
            </div>
            <input type="range" min={50} max={95} value={fundingThreshold} onChange={e => setFundingThreshold(parseInt(e.target.value))} className="w-full accent-forest" />
            <div className="flex justify-between text-xs text-stone dark:text-fog mt-1">
              <span>50 — lenient</span><span>95 — very strict</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="cp-label mb-0">Max proposal size (% of pot)</label>
              <span className="text-lg font-semibold text-forest dark:text-sage">{maxProposalPct}%</span>
            </div>
            <input type="range" min={5} max={50} value={maxProposalPct} onChange={e => setMaxProposalPct(parseInt(e.target.value))} className="w-full accent-forest" />
            <div className="text-xs text-stone dark:text-fog mt-1">
              Max single proposal: <span className="text-forest dark:text-sage font-medium">{(parseFloat(startingPot) * maxProposalPct / 100).toFixed(2)} GEN</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="cp-label mb-0">Upfront release on approval</label>
              <span className="text-lg font-semibold text-forest dark:text-sage">{upfrontReleasePct}%</span>
            </div>
            <input type="range" min={0} max={100} step={10} value={upfrontReleasePct} onChange={e => setUpfrontReleasePct(parseInt(e.target.value))} className="w-full accent-forest" />
            <div className="text-xs text-stone dark:text-fog mt-1">
              {100 - upfrontReleasePct}% held in escrow until delivery is verified by AI.
            </div>
          </div>

          <div>
            <label className="cp-label">Proposal submission fee (GEN)</label>
            <input type="number" className="cp-input" min="0" step="0.1" value={proposalFeeGEN} onChange={e => setProposalFeeGEN(e.target.value)} />
            <div className="text-xs text-stone dark:text-fog mt-1">Goes into the pot. Discourages spam proposals.</div>
          </div>

          {/* Preview */}
          <div className="cp-card-green flex flex-col gap-2 text-sm">
            <div className="font-semibold text-forest dark:text-sage">{communityName || "Your community"}</div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-stone dark:text-fog text-xs">
              <span>💰 {startingPot} GEN starting pot</span>
              <span>🎯 {fundingThreshold}/100 threshold</span>
              <span>📏 {maxProposalPct}% max proposal</span>
              <span>⬆️ {upfrontReleasePct}% upfront</span>
              <span>🎟️ {proposalFeeGEN} GEN fee</span>
            </div>
          </div>

          <ErrorMessage message={error} />

          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className="cp-btn-secondary" disabled={loading}>← Back</button>
            <button onClick={handleSubmit} disabled={!step3Valid || loading || !wallet.connected} className="cp-btn-primary">
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <Spinner />
                  Creating community...
                </span>
              ) : `Found ${communityName || "community"} →`}
            </button>
          </div>

          {!wallet.connected && (
            <div className="text-xs text-center text-coral">Connect a wallet to create a community.</div>
          )}
        </div>
      )}
    </div>
  );
}
