// ----------------------------------------------------------------
// CommunityPulse v2 — GenLayer contract interface
//
// Key differences from v1:
// - create_community, deposit_funds, submit_proposal are now payable
//   → value must be passed as a BigInt string, NOT .toString() of a number
// - sender identity comes from gl.message.sender_address.as_hex on-chain
//   → never pass an address as a parameter for auth-sensitive calls
// - New methods: retry_payout, submit_completion_evidence
// - New fields: upfront_release_pct, upfront_amount, escrowed_amount, etc.
//
// Value serialization:
//   The build guide confirms value must be passed as a BigInt string.
//   Use toRawUnits() from utils.ts for all GEN → raw conversions.
// ----------------------------------------------------------------

import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import type { Community, Proposal, EvidenceType } from "./types";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
const MAX_ATTEMPTS = 3;

// ----------------------------------------------------------------
// Client factory
// ----------------------------------------------------------------

function makeClient(account: ReturnType<typeof createAccount>) {
  return createClient({ chain: studionet, account });
}

export function makeAccount(privateKey?: `0x${string}`) {
  return createAccount(privateKey);
}

// ----------------------------------------------------------------
// Core write helpers
// ----------------------------------------------------------------

async function writeContract(
  account: ReturnType<typeof createAccount>,
  method: string,
  args: unknown[],
  valueRaw?: string   // raw GEN units as string, e.g. "1000000000000000000"
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

async function writeContractWithReturn(
  account: ReturnType<typeof createAccount>,
  method: string,
  args: unknown[],
  valueRaw?: string
): Promise<string> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const client = makeClient(account);
      console.log(`[contract] ${method} (with return) attempt ${attempt}/${MAX_ATTEMPTS}`);

      const txParams: Record<string, unknown> = {
        address: CONTRACT_ADDRESS,
        functionName: method,
        args,
        account,
        leaderOnly: false,
      };
      if (valueRaw) txParams.value = valueRaw;

      // Simulate first to get return value
      const returnValue = await client.simulateWriteContract({
        address: CONTRACT_ADDRESS,
        functionName: method,
        args,
      });

      const hash = await client.writeContract(txParams as any);
      await client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.ACCEPTED,
        retries: 120,
        interval: 4000,
      });
      console.log(`[contract] ${method} accepted, returned:`, returnValue);
      return returnValue as string;
    } catch (err: any) {
      console.error(`[contract] ${method} (with return) attempt ${attempt} failed:`, err?.message);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 3000));
        continue;
      }
      throw err;
    }
  }
  throw new Error("All attempts failed");
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
    proposalFeeRaw: string;      // raw units
    upfrontReleasePct: number;
    startingPotRaw: string;      // raw units — also the payable value
  }
): Promise<string> {
  return writeContractWithReturn(
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
  amountRaw: string    // raw units — also the payable value
): Promise<void> {
  return writeContract(account, "deposit_funds", [communityId], amountRaw);
}

export async function submitProposal(
  account: ReturnType<typeof createAccount>,
  params: {
    communityId: string;
    proposerName: string;
    title: string;
    amountRaw: string;   // raw units — the requested amount as a plain string param
    whatItDoes: string;
    whoItHelps: string;
    successMetric: string;
    timeline: string;
    feeRaw: string;      // raw units — the payable value (proposal fee)
  }
): Promise<string> {
  return writeContractWithReturn(
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
  return writeContractWithReturn(account, "revise_proposal", [
    params.originalProposalId,
    params.title,
    params.amountRaw,
    params.whatItDoes,
    params.whoItHelps,
    params.successMetric,
    params.timeline,
  ]);
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
