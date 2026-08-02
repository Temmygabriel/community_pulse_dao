"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/app/components/wallet/WalletProvider";

function toRawUnits(gen: number): string {
  const whole = Math.floor(gen);
  const frac = Math.round((gen - whole) * 1e9);
  const raw = BigInt(whole) * BigInt("1000000000000000000") + BigInt(frac) * BigInt("1000000000");
  return raw.toString();
}

type Step = 1 | 2 | 3;

export default function CreateCommunityPage() {
  const router = useRouter();
  const { wallet, account } = useWallet();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [founderName, setFounderName] = useState("");
  const [communityName, setCommunityName] = useState("");
  const [description, setDescription] = useState("");
  const [purpose, setPurpose] = useState("");
  const [alwaysFund, setAlwaysFund] = useState("");
  const [neverFund, setNeverFund] = useState("");
  const [whoBenefits, setWhoBenefits] = useState("");
  const [success, setSuccess] = useState("");
  const [startingPot, setStartingPot] = useState("5");
  const [fundingThreshold, setFundingThreshold] = useState(70);
  const [maxProposalPct, setMaxProposalPct] = useState(30);
  const [proposalFeeGEN, setProposalFeeGEN] = useState("1");
  const [upfrontReleasePct, setUpfrontReleasePct] = useState(50);

  const step1Valid = !!(founderName.trim() && communityName.trim() && description.trim());
  const step2Valid = !!(purpose.trim() && alwaysFund.trim() && neverFund.trim() && whoBenefits.trim() && success.trim());
  const step3Valid = parseFloat(startingPot) > 0;

  async function handleSubmit() {
    if (!account || !wallet.connected) { setError("Connect a wallet first."); return; }
    setLoading(true);
    setError("");
    try {
      const { createCommunity } = await import("@/lib/contract");
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

  const inputStyle = { width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)", fontSize: 14, outline: "none", background: "white", color: "#1A1A18", fontFamily: "inherit", boxSizing: "border-box" as const };
  const textareaStyle = { ...inputStyle, resize: "none" as const, minHeight: 80 };
  const labelStyle = { display: "block", fontSize: 11, fontWeight: 500 as const, textTransform: "uppercase" as const, letterSpacing: "0.08em", color: "#5F6B5A", marginBottom: 8 };
  const btnPrimary = { width: "100%", padding: "14px 24px", borderRadius: 12, background: loading ? "#5a8a72" : "#2D6A4F", color: "white", fontWeight: 500 as const, fontSize: 15, border: "none", cursor: loading ? "not-allowed" as const : "pointer" as const, fontFamily: "inherit" };
  const btnSecondary = { width: "100%", padding: "14px 24px", borderRadius: 12, border: "1px solid rgba(45,106,79,0.3)", background: "transparent", color: "#2D6A4F", fontWeight: 500 as const, fontSize: 15, cursor: "pointer" as const, fontFamily: "inherit" };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "#5F6B5A", textDecoration: "none" }}>
        ← Back
      </a>

      <div>
        <h1 style={{ fontSize: 28, fontWeight: 600, letterSpacing: "-0.02em", color: "#1A1A18", margin: "0 0 8px" }}>Found a community</h1>
        <p style={{ color: "#5F6B5A", fontSize: 14, margin: 0 }}>Write your constitution carefully — the AI will use it to judge every proposal forever.</p>
      </div>

      {/* Step progress */}
      <div style={{ display: "flex", gap: 8 }}>
        {["Identity", "Constitution", "Treasury"].map((label, i) => {
          const s = (i + 1) as Step;
          return (
            <div key={label} style={{ flex: 1 }}>
              <div style={{ height: 4, borderRadius: 999, background: s <= step ? "#2D6A4F" : "rgba(0,0,0,0.1)", marginBottom: 6 }} />
              <div style={{ fontSize: 12, color: s === step ? "#2D6A4F" : "#8A9985", fontWeight: s === step ? 500 : 400 }}>{label}</div>
            </div>
          );
        })}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ padding: "12px 16px", background: "rgba(216,243,220,0.4)", border: "1px solid rgba(45,106,79,0.2)", borderRadius: 12, fontSize: 13, color: "#5F6B5A" }}>
            Your wallet address becomes the founder permanently.
          </div>
          {wallet.connected && (
            <div style={{ fontFamily: "monospace", fontSize: 12, color: "#8A9985", background: "rgba(0,0,0,0.03)", padding: "8px 12px", borderRadius: 8, wordBreak: "break-all" }}>
              {wallet.address}
            </div>
          )}
          <div><label style={labelStyle}>Your display name</label><input style={inputStyle} placeholder="How members will see you..." value={founderName} onChange={e => setFounderName(e.target.value)} maxLength={30} /></div>
          <div><label style={labelStyle}>Community name</label><input style={inputStyle} placeholder="e.g. Lagos Dev Guild, Green Africa Fund..." value={communityName} onChange={e => setCommunityName(e.target.value)} maxLength={60} /></div>
          <div><label style={labelStyle}>Description</label><textarea style={textareaStyle} placeholder="One paragraph — what is this community and who is it for?" value={description} onChange={e => setDescription(e.target.value)} maxLength={300} /></div>
          <button onClick={() => setStep(2)} disabled={!step1Valid} style={{ ...btnPrimary, background: !step1Valid ? "#8A9985" : "#2D6A4F", cursor: !step1Valid ? "not-allowed" : "pointer" }}>Next — Write constitution →</button>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ padding: "12px 16px", background: "rgba(216,243,220,0.4)", border: "1px solid rgba(45,106,79,0.2)", borderRadius: 12, fontSize: 13, color: "#5F6B5A" }}>
            ⚖️ The AI reads these five sentences before scoring every proposal. Be specific.
          </div>
          <div><label style={labelStyle}>🎯 Purpose — what is this community for?</label><textarea style={textareaStyle} placeholder="e.g. We exist to fund open-source developer tools..." value={purpose} onChange={e => setPurpose(e.target.value)} maxLength={300} /></div>
          <div><label style={labelStyle}>✅ We always fund</label><textarea style={textareaStyle} placeholder="e.g. We always fund proposals that ship working code..." value={alwaysFund} onChange={e => setAlwaysFund(e.target.value)} maxLength={300} /></div>
          <div><label style={labelStyle}>🚫 We never fund</label><textarea style={textareaStyle} placeholder="e.g. We never fund marketing campaigns..." value={neverFund} onChange={e => setNeverFund(e.target.value)} maxLength={300} /></div>
          <div><label style={labelStyle}>👥 Who benefits</label><textarea style={textareaStyle} placeholder="e.g. Decisions should primarily benefit junior developers..." value={whoBenefits} onChange={e => setWhoBenefits(e.target.value)} maxLength={300} /></div>
          <div><label style={labelStyle}>🏆 Success looks like</label><textarea style={textareaStyle} placeholder="e.g. Success means at least one funded project ships..." value={success} onChange={e => setSuccess(e.target.value)} maxLength={300} /></div>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => setStep(1)} style={btnSecondary}>← Back</button>
            <button onClick={() => setStep(3)} disabled={!step2Valid} style={{ ...btnPrimary, background: !step2Valid ? "#8A9985" : "#2D6A4F", cursor: !step2Valid ? "not-allowed" : "pointer" }}>Next — Treasury →</button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label style={labelStyle}>Starting pot (GEN)</label>
            <input type="number" style={inputStyle} min="0.1" step="0.5" value={startingPot} onChange={e => setStartingPot(e.target.value)} />
            <div style={{ fontSize: 12, color: "#8A9985", marginTop: 6 }}>Real GEN deposited to start the treasury. Sent as payable value.</div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Funding threshold</label>
              <span style={{ fontSize: 18, fontWeight: 600, color: "#2D6A4F" }}>{fundingThreshold}/100</span>
            </div>
            <input type="range" min={50} max={95} value={fundingThreshold} onChange={e => setFundingThreshold(parseInt(e.target.value))} style={{ width: "100%", accentColor: "#2D6A4F" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#8A9985", marginTop: 4 }}>
              <span>50 — lenient</span><span>95 — very strict</span>
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Max proposal size (% of pot)</label>
              <span style={{ fontSize: 18, fontWeight: 600, color: "#2D6A4F" }}>{maxProposalPct}%</span>
            </div>
            <input type="range" min={5} max={50} value={maxProposalPct} onChange={e => setMaxProposalPct(parseInt(e.target.value))} style={{ width: "100%", accentColor: "#2D6A4F" }} />
            <div style={{ fontSize: 12, color: "#8A9985", marginTop: 4 }}>
              Max single proposal: <span style={{ color: "#2D6A4F", fontWeight: 600 }}>{(parseFloat(startingPot || "0") * maxProposalPct / 100).toFixed(2)} GEN</span>
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Upfront release on approval</label>
              <span style={{ fontSize: 18, fontWeight: 600, color: "#2D6A4F" }}>{upfrontReleasePct}%</span>
            </div>
            <input type="range" min={0} max={100} step={10} value={upfrontReleasePct} onChange={e => setUpfrontReleasePct(parseInt(e.target.value))} style={{ width: "100%", accentColor: "#2D6A4F" }} />
            <div style={{ fontSize: 12, color: "#8A9985", marginTop: 4 }}>
              {100 - upfrontReleasePct}% held in escrow until delivery verified by AI.
            </div>
          </div>

          <div>
            <label style={labelStyle}>Proposal fee (GEN)</label>
            <input type="number" style={inputStyle} min="0" step="0.1" value={proposalFeeGEN} onChange={e => setProposalFeeGEN(e.target.value)} />
            <div style={{ fontSize: 12, color: "#8A9985", marginTop: 6 }}>Goes into the pot. Discourages spam.</div>
          </div>

          {/* Preview */}
          <div style={{ padding: 16, background: "rgba(216,243,220,0.4)", border: "1px solid rgba(45,106,79,0.2)", borderRadius: 12 }}>
            <div style={{ fontWeight: 600, color: "#2D6A4F", marginBottom: 8 }}>{communityName}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 16px", fontSize: 12, color: "#5F6B5A" }}>
              <span>💰 {startingPot} GEN pot</span>
              <span>🎯 {fundingThreshold}/100 threshold</span>
              <span>📏 {maxProposalPct}% max</span>
              <span>⬆️ {upfrontReleasePct}% upfront</span>
              <span>🎟️ {proposalFeeGEN} GEN fee</span>
            </div>
          </div>

          {error && (
            <div style={{ padding: "12px 16px", background: "rgba(230,57,70,0.05)", border: "1px solid rgba(230,57,70,0.2)", borderRadius: 12, color: "#E63946", fontSize: 14 }}>
              {error}
            </div>
          )}

          {!wallet.connected && (
            <div style={{ textAlign: "center", fontSize: 13, color: "#E63946" }}>Connect a wallet to create a community.</div>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => setStep(2)} disabled={loading} style={btnSecondary}>← Back</button>
            <button onClick={handleSubmit} disabled={!step3Valid || loading || !wallet.connected} style={{ ...btnPrimary, background: (!step3Valid || loading || !wallet.connected) ? "#8A9985" : "#2D6A4F", cursor: (!step3Valid || loading || !wallet.connected) ? "not-allowed" : "pointer" }}>
              {loading ? "Creating community..." : `Found ${communityName || "community"} →`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}