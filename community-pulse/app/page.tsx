"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getRecentCommunities } from "@/lib/contract";
import { formatGENShort, statusLabel, statusColor, statusBg } from "@/lib/utils";
import type { Community } from "@/lib/types";
import { Spinner, EmptyState, StatusBadge } from "./components/ui/index";

export default function LandingPage() {
  const router = useRouter();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinId, setJoinId] = useState("");

  useEffect(() => {
    getRecentCommunities(8)
      .then(setCommunities)
      .catch(() => setCommunities([]))
      .finally(() => setLoading(false));
  }, []);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const id = joinId.trim().toUpperCase();
    if (id) router.push(`/community/${id}`);
  }

  return (
    <div className="cp-fade flex flex-col gap-8">

      {/* ── Hero ── */}
      <div className="pt-4">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-forest dark:text-sage bg-mint/40 dark:bg-forest/20 px-3 py-1 rounded-full mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-sage animate-pulse" />
          On-chain treasury — GenLayer studionet
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-ink dark:text-cream leading-tight mb-3">
          Pool funds.<br />
          <span className="text-forest dark:text-sage">Let the AI decide.</span>
        </h1>
        <p className="text-stone dark:text-fog text-base leading-relaxed max-w-lg">
          Write a 5-sentence constitution. Members propose how to spend the pot.
          AI scores every proposal against your values. Top proposals get funded automatically — real GEN, real escrow.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          {[
            ["AI judge", "Validators reach consensus"],
            ["Real GEN", "Funds actually move on-chain"],
            ["Escrow", "Delivery verified before full payout"],
            ["No whales", "One address, one voice"],
          ].map(([n, l]) => (
            <div key={n} className="flex items-center gap-1.5 text-xs bg-white dark:bg-white/4 border border-black/8 dark:border-white/8 rounded-lg px-2.5 py-1.5">
              <span className="font-semibold text-forest dark:text-sage">{n}</span>
              <span className="text-stone dark:text-fog">{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Actions ── */}
      <div className="flex flex-col gap-3">
        <Link href="/community/new" className="cp-btn-primary text-center block">
          Start a community →
        </Link>
        <form onSubmit={handleJoin} className="flex gap-2">
          <input
            className="cp-input flex-1"
            placeholder="Community ID (e.g. COM000001)"
            value={joinId}
            onChange={(e) => setJoinId(e.target.value.toUpperCase())}
            maxLength={9}
            style={{ fontVariantNumeric: "tabular-nums" }}
          />
          <button type="submit" className="cp-btn-secondary w-auto px-5" disabled={!joinId.trim()}>
            Join
          </button>
        </form>
      </div>

      {/* ── Recent communities ── */}
      <div>
        <div className="cp-section-label mb-3">Recent communities</div>
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner className="text-forest" />
          </div>
        ) : communities.length === 0 ? (
          <EmptyState message="No communities yet" sub="Be the first to create one above." />
        ) : (
          <div className="flex flex-col gap-3">
            {communities.map((c) => (
              <Link
                key={c.id}
                href={`/community/${c.id}`}
                className="cp-card hover:border-forest/30 hover:bg-mint/10 dark:hover:bg-forest/10 transition-all group"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="font-semibold text-ink dark:text-cream group-hover:text-forest dark:group-hover:text-sage transition-colors">
                      {c.name}
                    </div>
                    <div className="text-sm text-stone dark:text-fog mt-0.5 line-clamp-1">
                      {c.description}
                    </div>
                  </div>
                  <StatusBadge
                    label={c.status}
                    color={statusColor(c.status)}
                    bg={statusBg(c.status)}
                  />
                </div>
                <div className="flex items-center gap-4 text-xs text-stone dark:text-fog">
                  <span>
                    <span className="font-semibold text-forest dark:text-sage">{formatGENShort(c.pot_balance)}</span>
                    {" "}pot
                  </span>
                  <span>{c.member_count} members</span>
                  <span>{c.funded_count} funded</span>
                  <span className="font-mono text-stone/50 dark:text-fog/50 ml-auto">{c.id}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── How it works ── */}
      <div className="cp-card">
        <div className="cp-section-label mb-4">How it works</div>
        <div className="flex flex-col gap-4">
          {[
            ["🏛️", "Found a community", "Write 5 sentences — your constitution. Deposit real GEN to start the pot."],
            ["👥", "Members join and pool funds", "Anyone with the community ID can join. Members can also deposit GEN to grow the pot."],
            ["📝", "Propose how to spend the pot", "Submit a proposal with a budget, deliverables, and success metric. Pay a small fee as a spam deterrent."],
            ["⚖️", "AI scores against your constitution", "Multiple GenLayer validators independently score the proposal and reach consensus. No single point of control."],
            ["✅", "Funded proposals pay in two tranches", "Upfront on approval. The rest held in escrow, released only after the proposer submits verifiable delivery evidence."],
          ].map(([emoji, title, desc]) => (
            <div key={title as string} className="flex gap-3">
              <span className="text-xl flex-shrink-0 mt-0.5">{emoji}</span>
              <div>
                <div className="text-sm font-semibold text-ink dark:text-cream">{title}</div>
                <div className="text-sm text-stone dark:text-fog mt-0.5 leading-relaxed">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
