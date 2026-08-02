// ----------------------------------------------------------------
// CommunityPulse v2 — TypeScript types
// All fields match CommunityPulseV2.py exactly.
// ----------------------------------------------------------------

export interface Constitution {
  purpose: string;
  always_fund: string;
  never_fund: string;
  who_benefits: string;
  success_looks_like: string;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  founder: string;
  founder_name: string;
  constitution: Constitution;
  pot_balance: number;           // raw 18-decimal units
  funding_threshold: number;     // 0-100
  max_proposal_pct: number;      // 0-100
  proposal_fee: number;          // raw 18-decimal units
  upfront_release_pct: number;   // 0-100
  member_count: number;
  proposal_count: number;
  funded_count: number;
  completed_count: number;
  total_funded: number;          // raw 18-decimal units
  status: "active" | "depleted";
  created_at: number;
}

export interface PrincipleScores {
  purpose_alignment: number | null;
  community_benefit: number | null;
  constitutional_fit: number | null;
  feasibility: number | null;
  value_for_money: number | null;
}

export type ProposalStatus =
  | "pending"
  | "scoring"
  | "funded_partial"
  | "approved_unfunded"
  | "completed"
  | "completion_failed"
  | "revision"
  | "rejected";

export type EvidenceType = "github_repo" | "github_file" | "live_site" | "ipfs";

export interface Proposal {
  id: string;
  community_id: string;
  proposer: string;
  proposer_name: string;
  title: string;
  amount: number;                // raw 18-decimal units
  what_it_does: string;
  who_it_helps: string;
  success_metric: string;
  timeline: string;
  status: ProposalStatus;
  is_revision: boolean;
  original_proposal_id: string | null;
  pulse_count: number;
  pulse_bonus: number;
  base_score: number | null;
  total_score: number | null;
  principle_scores: PrincipleScores;
  recommendation: "FUND" | "REVISE" | "REJECT" | null;
  reasoning: string | null;
  concerns: string | null;
  revision_count: number;
  // Escrow / completion tracking
  upfront_amount: number;        // raw 18-decimal units
  upfront_paid: number;          // raw 18-decimal units
  escrowed_amount: number;       // raw 18-decimal units
  completion_evidence_type: EvidenceType | "";
  completion_evidence_url: string;
  completion_evidence_description: string;
  completion_delivered: boolean | null;
  completion_reasoning: string;
  completion_resubmission_count: number;
  created_at: number;
}

export interface WalletState {
  address: string;
  type: "burner" | "metamask";
  connected: boolean;
}
