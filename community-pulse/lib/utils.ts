// ----------------------------------------------------------------
// Unit conversion
// All on-chain values are raw 18-decimal integers.
// The Value (GEN) field in Studio auto-converts but plain params do NOT.
// ----------------------------------------------------------------

const GEN_DECIMALS = BigInt("1000000000000000000"); // 1e18

export function toRawUnits(gen: number): string {
  // Convert human GEN (e.g. 1.5) to raw integer string (e.g. "1500000000000000000")
  // Multiply via BigInt to avoid float precision loss on large values.
  const whole = Math.floor(gen);
  const frac = Math.round((gen - whole) * 1e9); // up to 9 decimal places
  const raw = BigInt(whole) * GEN_DECIMALS + BigInt(frac) * BigInt("1000000000");
  return raw.toString();
}

export function fromRawUnits(raw: number | string): number {
  // Convert raw integer to human GEN (may lose precision beyond 9 decimals — acceptable for display)
  const n = typeof raw === "string" ? BigInt(raw) : BigInt(Math.floor(raw));
  const whole = n / GEN_DECIMALS;
  const frac = n % GEN_DECIMALS;
  return Number(whole) + Number(frac) / 1e18;
}

export function formatGEN(raw: number | string, decimals = 3): string {
  const val = fromRawUnits(raw);
  if (val === 0) return "0 GEN";
  if (val < 0.001) return "< 0.001 GEN";
  return `${val.toFixed(decimals).replace(/\.?0+$/, "")} GEN`;
}

export function formatGENShort(raw: number | string): string {
  const val = fromRawUnits(raw);
  if (val >= 1000) return `${(val / 1000).toFixed(1)}k GEN`;
  if (val >= 1) return `${val.toFixed(2).replace(/\.?0+$/, "")} GEN`;
  return `${val.toFixed(4).replace(/\.?0+$/, "")} GEN`;
}

// ----------------------------------------------------------------
// Address helpers
// ----------------------------------------------------------------

export function truncateAddress(address: string, chars = 4): string {
  if (!address || address.length < chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

export function explorerTxUrl(hash: string): string {
  return `https://explorer-studio.genlayer.com/tx/${hash}`;
}

export function explorerAddressUrl(address: string): string {
  return `https://explorer-studio.genlayer.com/address/${address}`;
}

// ----------------------------------------------------------------
// Score helpers
// ----------------------------------------------------------------

export function scoreColor(score: number): string {
  if (score >= 70) return "#2D6A4F";
  if (score >= 50) return "#F4A261";
  return "#E63946";
}

export function scoreBg(score: number): string {
  if (score >= 70) return "#EDF7F0";
  if (score >= 50) return "#FFF4EC";
  return "#FEF2F2";
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending:          "Pending",
    scoring:          "Evaluating",
    funded_partial:   "Funded — awaiting delivery",
    approved_unfunded:"Approved — pot low",
    completed:        "Completed",
    completion_failed:"Delivery failed",
    revision:         "Needs revision",
    rejected:         "Rejected",
  };
  return map[status] ?? status;
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending:          "#8A9985",
    scoring:          "#74C69D",
    funded_partial:   "#2D6A4F",
    approved_unfunded:"#F4A261",
    completed:        "#2D6A4F",
    completion_failed:"#E63946",
    revision:         "#F4A261",
    rejected:         "#E63946",
  };
  return map[status] ?? "#8A9985";
}

export function statusBg(status: string): string {
  const map: Record<string, string> = {
    pending:          "rgba(138,153,133,0.1)",
    scoring:          "rgba(116,198,157,0.12)",
    funded_partial:   "rgba(45,106,79,0.1)",
    approved_unfunded:"rgba(244,162,97,0.12)",
    completed:        "rgba(45,106,79,0.1)",
    completion_failed:"rgba(230,57,70,0.08)",
    revision:         "rgba(244,162,97,0.12)",
    rejected:         "rgba(230,57,70,0.08)",
  };
  return map[status] ?? "rgba(138,153,133,0.1)";
}

// ----------------------------------------------------------------
// Evidence type metadata
// ----------------------------------------------------------------

export const EVIDENCE_TYPES = [
  {
    value: "github_repo",
    label: "GitHub repo",
    hint: "https://api.github.com/repos/{owner}/{repo}",
    description: "AI checks repo name, description, and topics match your deliverable.",
  },
  {
    value: "github_file",
    label: "GitHub file",
    hint: "https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{file}",
    description: "AI reads the raw file and checks the content matches what you promised.",
  },
  {
    value: "live_site",
    label: "Live site",
    hint: "https://your-deployed-app.com",
    description: "AI fetches the page HTML and checks it contains your deliverable. Works for server-rendered sites — not React/Next.js SPAs.",
  },
  {
    value: "ipfs",
    label: "IPFS",
    hint: "https://ipfs.io/ipfs/{CID}",
    description: "Immutable content via the ipfs.io gateway. Cannot be changed after submission.",
  },
] as const;
