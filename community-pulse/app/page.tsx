"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Community {
  id: string;
  name: string;
  description: string;
  pot_balance: number;
  member_count: number;
  funded_count: number;
  status: string;
}

function formatGEN(raw: number): string {
  if (!raw || raw === 0) return "0 GEN";
  const val = raw / 1e18;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k GEN`;
  if (val >= 1) return `${val.toFixed(2)} GEN`;
  return `${val.toFixed(4)} GEN`;
}

export default function LandingPage() {
  const router = useRouter();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [commLoading, setCommLoading] = useState(true);
  const [joinId, setJoinId] = useState("");

  useEffect(() => {
    import("@/lib/contract")
      .then(({ getRecentCommunities }) => getRecentCommunities(8))
      .then((data: Community[]) => setCommunities(data || []))
      .catch(() => setCommunities([]))
      .finally(() => setCommLoading(false));
  }, []);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const id = joinId.trim().toUpperCase();
    if (id) router.push(`/community/${id}`);
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "1.5rem 1rem", display: "flex", flexDirection: "column", gap: "2rem" }}>

      {/* Hero */}
      <div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 500, color: "#2D6A4F", background: "rgba(216,243,220,0.6)", padding: "4px 12px", borderRadius: 999, marginBottom: 16 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#74C69D", display: "inline-block" }} />
          On-chain treasury · GenLayer studionet
        </div>
        <h1 style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.15, color: "#1A1A18", margin: "0 0 12px" }}>
          Pool funds.<br />
          <span style={{ color: "#2D6A4F" }}>Let the AI decide.</span>
        </h1>
        <p style={{ color: "#5F6B5A", fontSize: 16, lineHeight: 1.6, margin: 0 }}>
          Write a 5-sentence constitution. Members propose how to spend the pot.
          AI scores every proposal against your values. Top proposals get funded — real GEN, real escrow.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
          {[["AI judge","Validators reach consensus"],["Real GEN","Funds move on-chain"],["Escrow","Verified before full payout"],["No whales","One address, one voice"]].map(([n,l]) => (
            <div key={n} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, padding: "6px 10px" }}>
              <span style={{ fontWeight: 600, color: "#2D6A4F" }}>{n}</span>
              <span style={{ color: "#5F6B5A" }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Link href="/community/new" style={{ display: "block", textAlign: "center", textDecoration: "none", padding: "14px 24px", borderRadius: 12, background: "#2D6A4F", color: "white", fontWeight: 500, fontSize: 15 }}>
          Start a community →
        </Link>
        <form onSubmit={handleJoin} style={{ display: "flex", gap: 8 }}>
          <input
            style={{ flex: 1, padding: "12px 16px", borderRadius: 12, border: "1px solid rgba(0,0,0,0.1)", fontSize: 14, outline: "none", background: "white", color: "#1A1A18" }}
            placeholder="Community ID (e.g. COM000001)"
            value={joinId}
            onChange={(e) => setJoinId(e.target.value.toUpperCase())}
            maxLength={9}
          />
          <button type="submit" disabled={!joinId.trim()} style={{ padding: "12px 20px", borderRadius: 12, border: "1px solid rgba(45,106,79,0.35)", background: "transparent", color: "#2D6A4F", fontWeight: 500, fontSize: 14, cursor: joinId.trim() ? "pointer" : "default", opacity: joinId.trim() ? 1 : 0.4 }}>
            Join
          </button>
        </form>
      </div>

      {/* Recent communities */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "#5F6B5A", marginBottom: 12 }}>Recent communities</div>
        {commLoading ? (
          <div style={{ color: "#8A9985", fontSize: 14 }}>Loading communities...</div>
        ) : communities.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, color: "#5F6B5A", fontSize: 14 }}>
            No communities yet. Be the first to create one.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {communities.map((c) => (
              <Link key={c.id} href={`/community/${c.id}`} style={{ textDecoration: "none" }}>
                <div style={{ background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: 16, cursor: "pointer" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "#1A1A18", marginBottom: 2 }}>{c.name}</div>
                      <div style={{ fontSize: 13, color: "#5F6B5A" }}>{c.description}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 999, background: c.status === "active" ? "rgba(45,106,79,0.1)" : "rgba(230,57,70,0.08)", color: c.status === "active" ? "#2D6A4F" : "#E63946" }}>
                      {c.status}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#5F6B5A" }}>
                    <span style={{ color: "#2D6A4F", fontWeight: 600 }}>{formatGEN(c.pot_balance)}</span>
                    <span>{c.member_count} members</span>
                    <span>{c.funded_count} funded</span>
                    <span style={{ fontFamily: "monospace", color: "#8A9985", marginLeft: "auto" }}>{c.id}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* How it works */}
      <div style={{ background: "white", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em", color: "#5F6B5A", marginBottom: 16 }}>How it works</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[
            ["🏛️","Found a community","Write 5 sentences — your constitution. Deposit real GEN to start the pot."],
            ["👥","Members pool funds","Anyone with the ID can join and deposit GEN to grow the treasury."],
            ["📝","Propose how to spend","Submit a proposal with a budget, deliverables, and success metric."],
            ["⚖️","AI scores proposals","Multiple validators score independently and reach consensus. No single point of control."],
            ["✅","Funded in two tranches","Upfront on approval. Rest held in escrow until delivery is verified by AI."],
          ].map(([emoji, title, desc]) => (
            <div key={title as string} style={{ display: "flex", gap: 12 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{emoji}</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1A18" }}>{title}</div>
                <div style={{ fontSize: 13, color: "#5F6B5A", marginTop: 2, lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}