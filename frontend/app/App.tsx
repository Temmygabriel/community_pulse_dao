"use client";
// CommunityPulse — Main Orchestrator
// Session 3

import { useState, useEffect, useRef, useCallback } from "react";
import { Screen, Community, Proposal } from "../types";
import {
  makeAccount,
  createCommunity,
  joinCommunity,
  depositFunds,
  submitProposal,
  addPulse,
  evaluateProposal,
  reviseProposal,
  getCommunity,
  getProposal,
  getCommunityProposals,
  getRecentCommunities,
} from "../lib/contract";

import LandingScreen from "../components/LandingScreen";
import CreateCommunityScreen from "../components/CreateCommunityScreen";
import JoinCommunityScreen from "../components/JoinCommunityScreen";
import CommunityDashboard from "../components/CommunityDashboard";
import ProposalFeedScreen from "../components/ProposalFeedScreen";
import SubmitProposalScreen from "../components/SubmitProposalScreen";
import ProposalDetailScreen from "../components/ProposalDetailScreen";
import JudgingScreen from "../components/JudgingScreen";
import ConstitutionScreen from "../components/ConstitutionScreen";
import TreasuryScreen from "../components/TreasuryScreen";

const POLL_INTERVAL = 3000;
const CALC_FALLBACK = 30_000;

export default function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [playerAddress, setPlayerAddress] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [activeCommunityId, setActiveCommunityId] = useState("");
  const [activeProposalId, setActiveProposalId] = useState("");
  const [community, setCommunity] = useState<Community | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState("");

  const accountRef = useRef<ReturnType<typeof makeAccount> | null>(null);
  const screenRef = useRef<Screen>("landing");
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollProposalIdRef = useRef<string>("");
  const calculatingRef = useRef(false);
  const calcStartedAtRef = useRef<number>(0);

  // ── Account initialisation ─────────────────────────────────────
  useEffect(() => {
    const savedName = localStorage.getItem("cp_name");
    let acc: ReturnType<typeof makeAccount>;
    const savedKey = localStorage.getItem("cp_private_key");

    try {
      if (
        savedKey &&
        savedKey !== "undefined" &&
        savedKey !== "null" &&
        savedKey.startsWith("0x")
      ) {
        acc = makeAccount(savedKey as `0x${string}`);
      } else {
        if (savedKey !== null) {
          localStorage.removeItem("cp_private_key");
          localStorage.removeItem("cp_address");
        }
        acc = makeAccount();
        localStorage.setItem("cp_private_key", acc.privateKey);
      }
    } catch {
      localStorage.removeItem("cp_private_key");
      localStorage.removeItem("cp_address");
      localStorage.removeItem("cp_name");
      acc = makeAccount();
      localStorage.setItem("cp_private_key", acc.privateKey);
    }

    accountRef.current = acc;
    localStorage.setItem("cp_address", acc.address);
    setPlayerAddress(acc.address);
    if (savedName) setPlayerName(savedName);
  }, []);

  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  // ── Polling ────────────────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startProposalPolling = useCallback(
    (proposalId: string) => {
      stopPolling();
      pollProposalIdRef.current = proposalId;

      const poll = async () => {
        if (!pollProposalIdRef.current) return;
        if (!["judging"].includes(screenRef.current)) return;

        try {
          const data: Proposal = await getProposal(pollProposalIdRef.current);
          if (!data || data.error) return;

          setProposal(data);

          // Stop polling when scoring is complete
          if (
            data.status !== "pending" &&
            data.status !== "scoring"
          ) {
            stopPolling();
            calculatingRef.current = false;
            setScreen("proposal_detail");
          }
        } catch {
          /* network blip — keep polling */
        }
      };

      poll();
      pollTimerRef.current = setInterval(poll, POLL_INTERVAL);
    },
    [stopPolling]
  );

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // ── Account helper ─────────────────────────────────────────────
  function getAccount() {
    if (!accountRef.current) {
      const savedKey = localStorage.getItem("cp_private_key");
      try {
        if (
          savedKey &&
          savedKey !== "undefined" &&
          savedKey !== "null" &&
          savedKey.startsWith("0x")
        ) {
          accountRef.current = makeAccount(savedKey as `0x${string}`);
        } else {
          accountRef.current = makeAccount();
          localStorage.setItem("cp_private_key", accountRef.current.privateKey);
        }
      } catch {
        localStorage.removeItem("cp_private_key");
        accountRef.current = makeAccount();
        localStorage.setItem("cp_private_key", accountRef.current.privateKey);
      }
      localStorage.setItem("cp_address", accountRef.current.address);
      setPlayerAddress(accountRef.current.address);
    }
    return accountRef.current;
  }

  // ── Handlers ───────────────────────────────────────────────────

  function handleSetName(name: string) {
    setPlayerName(name);
    localStorage.setItem("cp_name", name);
  }

  async function handleCreateCommunity(params: {
    founderName: string;
    communityName: string;
    description: string;
    constitutionPurpose: string;
    constitutionAlwaysFund: string;
    constitutionNeverFund: string;
    constitutionWhoBenefits: string;
    constitutionSuccess: string;
    initialPot: number;
    fundingThreshold: number;
    maxProposalPct: number;
    proposalFee: number;
  }) {
    setLoading("Creating community...");
    setError("");
    const acc = getAccount();

    if (params.founderName.trim()) {
      handleSetName(params.founderName.trim());
    }

    // Show judging screen immediately — context "community"
    setScreen("judging");

    try {
      const communityId = await createCommunity(
        acc,
        acc.address,
        params.founderName,
        params.communityName,
        params.description,
        params.constitutionPurpose,
        params.constitutionAlwaysFund,
        params.constitutionNeverFund,
        params.constitutionWhoBenefits,
        params.constitutionSuccess,
        params.initialPot,
        params.fundingThreshold,
        params.maxProposalPct,
        params.proposalFee
      );

      if (!communityId) {
        throw new Error("No community ID returned");
      }

      setActiveCommunityId(communityId);

      // Load community data
      const communityData = await getCommunity(communityId);
      setCommunity(communityData);

      setScreen("community_dashboard");
    } catch (e: any) {
      console.error(e);
      setError("Failed to create community. Please try again.");
      setScreen("create_community");
    } finally {
      setLoading("");
    }
  }

  async function handleJoinCommunity(communityId: string, name: string) {
    setLoading("Joining community...");
    setError("");
    const acc = getAccount();

    if (name.trim()) {
      handleSetName(name.trim());
    }

    try {
      // First load the community to verify it exists
      const communityData = await getCommunity(communityId.trim().toUpperCase());
      if (communityData.error) {
        throw new Error("Community not found");
      }

      await joinCommunity(acc, communityId.trim().toUpperCase(), acc.address, name);

      // Reload community after joining
      const updated = await getCommunity(communityId.trim().toUpperCase());
      setCommunity(updated);
      setActiveCommunityId(communityId.trim().toUpperCase());
      setScreen("community_dashboard");
    } catch (e: any) {
      console.error(e);
      setError(
        e.message === "Community not found"
          ? "Community not found. Check the ID and try again."
          : "Failed to join community. Try again."
      );
    } finally {
      setLoading("");
    }
  }

  async function handleDepositFunds(amount: number) {
    if (!activeCommunityId) return;
    setLoading("Depositing funds...");
    setError("");
    const acc = getAccount();

    try {
      await depositFunds(acc, activeCommunityId, acc.address, amount);
      // Refresh community
      const updated = await getCommunity(activeCommunityId);
      setCommunity(updated);
    } catch (e: any) {
      console.error(e);
      setError("Failed to deposit funds. Try again.");
    } finally {
      setLoading("");
    }
  }

  async function handleSubmitProposal(params: {
    title: string;
    amount: number;
    whatItDoes: string;
    whoItHelps: string;
    successMetric: string;
    timeline: string;
  }) {
    if (!activeCommunityId) return;
    setLoading("Submitting proposal...");
    setError("");
    const acc = getAccount();

    try {
      const proposalId = await submitProposal(
        acc,
        activeCommunityId,
        acc.address,
        playerName,
        params.title,
        params.amount,
        params.whatItDoes,
        params.whoItHelps,
        params.successMetric,
        params.timeline
      );

      if (!proposalId) {
        throw new Error("No proposal ID returned — check membership and pot balance");
      }

      setActiveProposalId(proposalId);

      // Load initial proposal state
      const proposalData = await getProposal(proposalId);
      setProposal(proposalData);

      // Show judging screen — context "proposal"
      setScreen("judging");
      setLoading("");

      // Fire evaluate immediately (mutex guard)
      if (!calculatingRef.current) {
        calculatingRef.current = true;
        calcStartedAtRef.current = Date.now();
        try {
          await evaluateProposal(acc, proposalId);
        } catch {
          // evaluate fired — polling will catch the result
          calculatingRef.current = false;
        }
      }

      // Start polling
      startProposalPolling(proposalId);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to submit proposal. Try again.");
      setScreen("submit_proposal");
      setLoading("");
    }
  }

  async function handleReviseProposal(params: {
    title: string;
    amount: number;
    whatItDoes: string;
    whoItHelps: string;
    successMetric: string;
    timeline: string;
  }) {
    if (!activeProposalId) return;
    setLoading("Submitting revision...");
    setError("");
    const acc = getAccount();

    try {
      const newProposalId = await reviseProposal(
        acc,
        activeProposalId,
        acc.address,
        params.title,
        params.amount,
        params.whatItDoes,
        params.whoItHelps,
        params.successMetric,
        params.timeline
      );

      if (!newProposalId) {
        throw new Error("No proposal ID returned from revision");
      }

      setActiveProposalId(newProposalId);

      const proposalData = await getProposal(newProposalId);
      setProposal(proposalData);

      // Show judging screen — context "proposal"
      setScreen("judging");
      setLoading("");

      // Fire evaluate immediately
      if (!calculatingRef.current) {
        calculatingRef.current = true;
        calcStartedAtRef.current = Date.now();
        try {
          await evaluateProposal(acc, newProposalId);
        } catch {
          calculatingRef.current = false;
        }
      }

      startProposalPolling(newProposalId);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to submit revision. Try again.");
      setScreen("proposal_detail");
      setLoading("");
    }
  }

  async function handleAddPulse(proposalId: string) {
    setLoading("Adding pulse...");
    setError("");
    const acc = getAccount();

    try {
      await addPulse(acc, proposalId, acc.address);
      // Refresh proposal
      const updated = await getProposal(proposalId);
      setProposal(updated);
    } catch (e: any) {
      console.error(e);
      setError("Failed to add pulse. Try again.");
    } finally {
      setLoading("");
    }
  }

  async function handleLoadCommunity(communityId: string) {
    setLoading("Loading community...");
    setError("");
    try {
      const data = await getCommunity(communityId);
      if (data.error) throw new Error("Not found");
      setCommunity(data);
      setActiveCommunityId(communityId);
    } catch {
      setError("Failed to load community.");
    } finally {
      setLoading("");
    }
  }

  async function handleLoadProposal(proposalId: string) {
    setLoading("Loading proposal...");
    setError("");
    try {
      const data = await getProposal(proposalId);
      if (data.error) throw new Error("Not found");
      setProposal(data);
      setActiveProposalId(proposalId);
      setScreen("proposal_detail");
    } catch {
      setError("Failed to load proposal.");
    } finally {
      setLoading("");
    }
  }

  function handleNavigateToDashboard() {
    stopPolling();
    calculatingRef.current = false;
    setError("");
    setScreen("community_dashboard");
  }

  function handleNavigateToLanding() {
    stopPolling();
    calculatingRef.current = false;
    setCommunity(null);
    setProposal(null);
    setActiveCommunityId("");
    setActiveProposalId("");
    setError("");
    setScreen("landing");
  }

  // ── Screen renderer ────────────────────────────────────────────
  const renderScreen = () => {
    switch (screen) {
      case "landing":
        return (
          <LandingScreen
            playerAddress={playerAddress}
            playerName={playerName}
            onSetName={handleSetName}
            onNavigate={setScreen}
            onJoinCommunity={(id, name) => handleJoinCommunity(id, name)}
            loading={loading}
            error={error}
          />
        );

      case "create_community":
        return (
          <CreateCommunityScreen
            playerAddress={playerAddress}
            playerName={playerName}
            onSubmit={handleCreateCommunity}
            onBack={() => setScreen("landing")}
            loading={loading}
            error={error}
          />
        );

      case "join_community":
        return (
          <JoinCommunityScreen
            playerName={playerName}
            onJoin={handleJoinCommunity}
            onBack={() => setScreen("landing")}
            loading={loading}
            error={error}
          />
        );

      case "community_dashboard":
        if (!community) return null;
        return (
          <CommunityDashboard
            community={community}
            playerAddress={playerAddress}
            onNavigate={setScreen}
            onBack={handleNavigateToLanding}
            loading={loading}
            error={error}
          />
        );

      case "proposal_feed":
        if (!community) return null;
        return (
          <ProposalFeedScreen
            community={community}
            playerAddress={playerAddress}
            onSelectProposal={(p) => {
              setProposal(p);
              setActiveProposalId(p.id);
              setScreen("proposal_detail");
            }}
            onBack={() => setScreen("community_dashboard")}
            loading={loading}
          />
        );

      case "submit_proposal":
        if (!community) return null;
        return (
          <SubmitProposalScreen
            community={community}
            playerAddress={playerAddress}
            onSubmit={handleSubmitProposal}
            onBack={() => setScreen("community_dashboard")}
            loading={loading}
            error={error}
          />
        );

      case "proposal_detail":
        if (!proposal) return null;
        return (
          <ProposalDetailScreen
            proposal={proposal}
            community={community}
            playerAddress={playerAddress}
            onAddPulse={() => handleAddPulse(proposal.id)}
            onRevise={() => {
              setActiveProposalId(proposal.id);
              setScreen("submit_proposal");
            }}
            onBack={() => setScreen("proposal_feed")}
            loading={loading}
            error={error}
          />
        );

      case "judging":
        return (
          <JudgingScreen
            context={activeProposalId && proposal ? "proposal" : "community"}
            communityName={community?.name ?? ""}
            proposalId={activeProposalId}
            proposalTitle={proposal?.title ?? ""}
          />
        );

      case "constitution":
        if (!community) return null;
        return (
          <ConstitutionScreen
            community={community}
            onBack={() => setScreen("community_dashboard")}
          />
        );

      case "treasury":
        if (!community) return null;
        return (
          <TreasuryScreen
            community={community}
            playerAddress={playerAddress}
            onDeposit={handleDepositFunds}
            onBack={() => setScreen("community_dashboard")}
            loading={loading}
            error={error}
          />
        );

      default:
        return null;
    }
  };

  return (
    <main className="app-root">
      <div className="app-container">{renderScreen()}</div>
    </main>
  );
}
