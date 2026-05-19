// CommunityPulse — GenLayer Contract Utils
// Session 3

import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
const MAX_ATTEMPTS = 3;

function makeClient(account: ReturnType<typeof createAccount>) {
  return createClient({ chain: studionet, account });
}

export function makeAccount(privateKey?: `0x${string}`) {
  return createAccount(privateKey);
}

export async function writeContract(
  account: ReturnType<typeof createAccount>,
  method: string,
  args: unknown[]
): Promise<void> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const client = makeClient(account);
      console.log(`writeContract attempt ${attempt}/${MAX_ATTEMPTS}: ${method}`);
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: method,
        args,
        account,
        leaderOnly: false,
      } as any);
      await client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.ACCEPTED,
        retries: 120,
        interval: 4000,
      });
      console.log(`writeContract success: ${method}`);
      return;
    } catch (err: any) {
      console.error(`writeContract ${method} attempt ${attempt} failed:`, err?.message, err);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 3000));
        continue;
      }
      throw err;
    }
  }
}

export async function writeContractWithReturn(
  account: ReturnType<typeof createAccount>,
  method: string,
  args: unknown[]
): Promise<string> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const client = makeClient(account);
      console.log(`writeContractWithReturn attempt ${attempt}/${MAX_ATTEMPTS}: ${method}`);
      const returnValue = await client.simulateWriteContract({
        address: CONTRACT_ADDRESS,
        functionName: method,
        args,
      });
      const hash = await client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: method,
        args,
        account,
        leaderOnly: false,
      } as any);
      await client.waitForTransactionReceipt({
        hash,
        status: TransactionStatus.ACCEPTED,
        retries: 120,
        interval: 4000,
      });
      console.log(`writeContractWithReturn success: ${method}, returned:`, returnValue);
      return returnValue as string;
    } catch (err: any) {
      console.error(`writeContractWithReturn ${method} attempt ${attempt} failed:`, err?.message, err);
      if (attempt < MAX_ATTEMPTS) {
        await new Promise((r) => setTimeout(r, attempt * 3000));
        continue;
      }
      throw err;
    }
  }
  throw new Error("All attempts failed");
}

export async function readContract(method: string, args: unknown[]): Promise<string> {
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
// CommunityPulse-specific functions
// ----------------------------------------------------------------

export async function createCommunity(
  account: ReturnType<typeof createAccount>,
  founderAddress: string,
  founderName: string,
  communityName: string,
  description: string,
  constitutionPurpose: string,
  constitutionAlwaysFund: string,
  constitutionNeverFund: string,
  constitutionWhoBenefits: string,
  constitutionSuccess: string,
  initialPot: number,
  fundingThreshold: number,
  maxProposalPct: number,
  proposalFee: number
): Promise<string> {
  return writeContractWithReturn(account, "create_community", [
    founderAddress,
    founderName,
    communityName,
    description,
    constitutionPurpose,
    constitutionAlwaysFund,
    constitutionNeverFund,
    constitutionWhoBenefits,
    constitutionSuccess,
    String(initialPot),
    String(fundingThreshold),
    String(maxProposalPct),
    String(proposalFee),
  ]);
}

export async function joinCommunity(
  account: ReturnType<typeof createAccount>,
  communityId: string,
  memberAddress: string,
  memberName: string
): Promise<void> {
  return writeContract(account, "join_community", [
    communityId,
    memberAddress,
    memberName,
  ]);
}

export async function depositFunds(
  account: ReturnType<typeof createAccount>,
  communityId: string,
  depositorAddress: string,
  amount: number
): Promise<void> {
  return writeContract(account, "deposit_funds", [
    communityId,
    depositorAddress,
    String(amount),
  ]);
}

export async function submitProposal(
  account: ReturnType<typeof createAccount>,
  communityId: string,
  proposerAddress: string,
  proposerName: string,
  title: string,
  amount: number,
  whatItDoes: string,
  whoItHelps: string,
  successMetric: string,
  timeline: string
): Promise<string> {
  return writeContractWithReturn(account, "submit_proposal", [
    communityId,
    proposerAddress,
    proposerName,
    title,
    String(amount),
    whatItDoes,
    whoItHelps,
    successMetric,
    timeline,
  ]);
}

export async function addPulse(
  account: ReturnType<typeof createAccount>,
  proposalId: string,
  memberAddress: string
): Promise<void> {
  return writeContract(account, "add_pulse", [proposalId, memberAddress]);
}

export async function evaluateProposal(
  account: ReturnType<typeof createAccount>,
  proposalId: string
): Promise<void> {
  return writeContract(account, "evaluate_proposal", [proposalId]);
}

export async function reviseProposal(
  account: ReturnType<typeof createAccount>,
  originalProposalId: string,
  proposerAddress: string,
  title: string,
  amount: number,
  whatItDoes: string,
  whoItHelps: string,
  successMetric: string,
  timeline: string
): Promise<string> {
  return writeContractWithReturn(account, "revise_proposal", [
    originalProposalId,
    proposerAddress,
    title,
    String(amount),
    whatItDoes,
    whoItHelps,
    successMetric,
    timeline,
  ]);
}

export async function getCommunity(communityId: string) {
  const raw = await readContract("get_community", [communityId]);
  return JSON.parse(raw);
}

export async function getProposal(proposalId: string) {
  const raw = await readContract("get_proposal", [proposalId]);
  return JSON.parse(raw);
}

export async function getCommunityProposals(communityId: string) {
  const raw = await readContract("get_community_proposals", [communityId]);
  return JSON.parse(raw);
}

export async function getFundedProposals(communityId: string) {
  const raw = await readContract("get_funded_proposals", [communityId]);
  return JSON.parse(raw);
}

export async function getMyProposals(address: string) {
  const raw = await readContract("get_my_proposals", [address]);
  return JSON.parse(raw);
}

export async function getCommunityMembers(communityId: string) {
  const raw = await readContract("get_community_members", [communityId]);
  return JSON.parse(raw);
}

export async function getRecentCommunities(limit: number) {
  const raw = await readContract("get_recent_communities", [limit]);
  return JSON.parse(raw);
}
