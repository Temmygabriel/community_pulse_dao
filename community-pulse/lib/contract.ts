// ----------------------------------------------------------------
// CommunityPulse v2 — GenLayer contract interface
// ----------------------------------------------------------------

import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import type { Community, Proposal, EvidenceType } from "./types";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
const MAX_ATTEMPTS = 3;

function makeClient(account: ReturnType<typeof createAccount>) {
  return createClient({ chain: studionet, account });
}

export function makeAccount(privateKey?: `0x${string}`) {
  return createAccount(privateKey);
}

// ----------------------------------------------------------------
// Core helpers
// ----------------------------------------------------------------

async function writeContract(
  account: ReturnType<typeof createAccount>,
  method: string,
  args: unknown[],
  valueRaw?: string
): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const client = makeClient(account);
      console.log(`[contract] ${method} attempt ${attempt}/${MAX_ATTEMPTS}`);
      const txParams: Record<string, unknown> = {
        address: CONTRACT_ADDRESS,
        functionName: method,
        args,
        account,
        leaderOnly: false,
      };
      if (valueRaw) txParams.value = valueRaw;
      const hash = await client.writeContract(txParams as any);
      await client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.ACCEPTED,
        retries: 120,
        interval: 4000,
      });
      console.log(`[contract] ${method} accepted`);
      return;
    } catch (err: any) {
      console.error(`[contract] ${method} attempt ${attempt} failed:`, err?.message);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 3000));
        continue;
      }
      throw err;
    }
  }
}

async function readContract(method: string, args: unknown[]): Promise<string> {
  const account = createAccount();
  const client = makeClient(account);
  const result = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: method,
    args,
  });
  return result as string;
}

// ----------------------------------------------------------------
// ID derivation helpers
// Read the counter before tx, compute the new ID after
// This replaces simulateWriteContract which doesn't work with payable calls
// ----------------------------------------------------------------

async function getCommunityCount(): Promise<number> {
  try {
    const c = await readContract("get_recent_communities", [1]);
    const parsed = JSON.parse(c);
    if (parsed && parsed.length > 0) return parsed[0].created_at;
    return 0;
  } catch {
    return 0;
  }
}

function makeCommunityId(n: number): string {
  return "COM" + String(n).padStart(6, "0");
}

function makeProposalId(n: number): string {
  return "PRO" + String(n).padStart(6, "0");
}

// ----------------------------------------------------------------
// Write methods
// ----------------------------------------------------------------

export async function createCommunity(
  account: ReturnType<typeof createAccount>,
  params: {
    founderName: string;
    communityName: string;
    description: string;
    constitutionPurpose: string;
    constitutionAlwaysFund: string;
    constitutionNeverFund: string;
    constitutionWhoBenefits: string;
    constitutionSuccess: string;
    fundingThreshold: number;
    maxProposalPct: number;
    proposalFeeRaw: string;
    upfrontReleasePct: number;
    startingPotRaw: string;
  }
): Promise<string> {
  // Get current count so we can compute the new ID
  const before = await getCommunityCount();

  await writeContract(
    account,
    "create_community",
    [
      params.founderName,
      params.communityName,
      params.description,
      params.constitutionPurpose,
      params.constitutionAlwaysFund,
      params.constitutionNeverFund,
      params.constitutionWhoBenefits,
      params.constitutionSuccess,
      String(params.fundingThreshold),
      String(params.maxProposalPct),
      params.proposalFeeRaw,
      String(params.upfrontReleasePct),
    ],
    params.startingPotRaw
  );

  // The new community ID is before + 1
  return makeCommunityId(before + 1);
}

export async function joinCommunity(
  account: ReturnType<typeof createAccount>,
  communityId: string,
  memberName: string
): Promise<void> {
  return writeContract(account, "join_community", [communityId, memberName]);
}

export async function depositFunds(
  account: ReturnType<typeof createAccount>,
  communityId: string,
  amountRaw: string
): Promise<void> {
  return writeContract(account, "deposit_funds", [communityId], amountRaw);
}

export async function submitProposal(
  account: ReturnType<typeof createAccount>,
  params: {
    communityId: string;
    proposerName: string;
    title: string;
    amountRaw: string;
    whatItDoes: string;
    whoItHelps: string;
    successMetric: string;
    timeline: string;
    feeRaw: string;
  }
): Promise<string> {
  // Read community to get current proposal count for ID derivation
  let proposalsBefore = 0;
  try {
    const c = await getCommunity(params.communityId);
    proposalsBefore = c.proposal_count || 0;
  } catch { /* use 0 */ }

  await writeContract(
    account,
    "submit_proposal",
    [
      params.communityId,
      params.proposerName,
      params.title,
      params.amountRaw,
      params.whatItDoes,
      params.whoItHelps,
      params.successMetric,
      params.timeline,
    ],
    params.feeRaw
  );

  // Read community again to get the actual new proposal count
  try {
    const c = await getCommunity(params.communityId);
    const proposals = await getCommunityProposals(params.communityId);
    if (proposals.length > 0) {
      return proposals[proposals.length - 1].id;
    }
  } catch { /* fall through */ }

  return makeProposalId(proposalsBefore + 1);
}

export async function addPulse(
  account: ReturnType<typeof createAccount>,
  proposalId: string
): Promise<void> {
  return writeContract(account, "add_pulse", [proposalId]);
}

export async function evaluateProposal(
  account: ReturnType<typeof createAccount>,
  proposalId: string
): Promise<void> {
  return writeContract(account, "evaluate_proposal", [proposalId]);
}

export async function retryPayout(
  account: ReturnType<typeof createAccount>,
  proposalId: string
): Promise<void> {
  return writeContract(account, "retry_payout", [proposalId]);
}

export async function submitCompletionEvidence(
  account: ReturnType<typeof createAccount>,
  params: {
    proposalId: string;
    evidenceType: EvidenceType;
    evidenceUrl: string;
    evidenceDescription: string;
  }
): Promise<void> {
  return writeContract(account, "submit_completion_evidence", [
    params.proposalId,
    params.evidenceType,
    params.evidenceUrl,
    params.evidenceDescription,
  ]);
}

export async function reviseProposal(
  account: ReturnType<typeof createAccount>,
  params: {
    originalProposalId: string;
    title: string;
    amountRaw: string;
    whatItDoes: string;
    whoItHelps: string;
    successMetric: string;
    timeline: string;
  }
): Promise<string> {
  await writeContract(account, "revise_proposal", [
    params.originalProposalId,
    params.title,
    params.amountRaw,
    params.whatItDoes,
    params.whoItHelps,
    params.successMetric,
    params.timeline,
  ]);

  // Get the original proposal's community and find the newest proposal
  try {
    const original = await getProposal(params.originalProposalId);
    const proposals = await getCommunityProposals(original.community_id);
    if (proposals.length > 0) {
      return proposals[proposals.length - 1].id;
    }
  } catch { /* fall through */ }

  return "";
}

// ----------------------------------------------------------------
// Read methods
// ----------------------------------------------------------------

export async function getCommunity(communityId: string): Promise<Community> {
  const raw = await readContract("get_community", [communityId]);
  return JSON.parse(raw);
}

export async function getProposal(proposalId: string): Promise<Proposal> {
  const raw = await readContract("get_proposal", [proposalId]);
  return JSON.parse(raw);
}

export async function getCommunityProposals(communityId: string): Promise<Proposal[]> {
  const raw = await readContract("get_community_proposals", [communityId]);
  return JSON.parse(raw);
}

export async function getFundedProposals(communityId: string): Promise<Proposal[]> {
  const raw = await readContract("get_funded_proposals", [communityId]);
  return JSON.parse(raw);
}

export async function getMyProposals(address: string): Promise<Proposal[]> {
  const raw = await readContract("get_my_proposals", [address]);
  return JSON.parse(raw);
}

export async function getCommunityMembers(communityId: string): Promise<string[]> {
  const raw = await readContract("get_community_members", [communityId]);
  return JSON.parse(raw);
}

export async function getRecentCommunities(limit: number): Promise<Community[]> {
  const raw = await readContract("get_recent_communities", [limit]);
  return JSON.parse(raw);
}

export async function getContractBalance(): Promise<string> {
  return readContract("get_contract_balance", []);
}