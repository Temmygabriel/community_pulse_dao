# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *

import json


class CommunityPulse(gl.Contract):

    community_count: u256
    proposal_count: u256
    communities: TreeMap[str, str]
    proposals: TreeMap[str, str]
    community_proposals: TreeMap[str, str]
    member_proposals: TreeMap[str, str]
    community_members: TreeMap[str, str]
    proposal_pulses: TreeMap[str, str]

    def __init__(self):
        self.community_count = u256(0)
        self.proposal_count = u256(0)

    # ----------------------------------------------------------------
    # Internal helpers
    # ----------------------------------------------------------------

    def _make_community_id(self) -> str:
        self.community_count = u256(int(self.community_count) + 1)
        return "COM" + str(int(self.community_count)).zfill(6)

    def _make_proposal_id(self) -> str:
        self.proposal_count = u256(int(self.proposal_count) + 1)
        return "PRO" + str(int(self.proposal_count)).zfill(6)

    def _read_community(self, community_id: str) -> dict:
        return json.loads(self.communities[community_id])

    def _write_community(self, community_id: str, data: dict) -> None:
        self.communities[community_id] = json.dumps(data)

    def _read_proposal(self, proposal_id: str) -> dict:
        return json.loads(self.proposals[proposal_id])

    def _write_proposal(self, proposal_id: str, data: dict) -> None:
        self.proposals[proposal_id] = json.dumps(data)

    def _get_community_proposals(self, community_id: str) -> list:
        raw = self.community_proposals.get(community_id)
        return [] if raw is None else json.loads(raw)

    def _set_community_proposals(self, community_id: str, ids: list) -> None:
        self.community_proposals[community_id] = json.dumps(ids)

    def _get_member_proposals(self, address: str) -> list:
        raw = self.member_proposals.get(address)
        return [] if raw is None else json.loads(raw)

    def _set_member_proposals(self, address: str, ids: list) -> None:
        self.member_proposals[address] = json.dumps(ids)

    def _get_community_members(self, community_id: str) -> list:
        raw = self.community_members.get(community_id)
        return [] if raw is None else json.loads(raw)

    def _set_community_members(self, community_id: str, members: list) -> None:
        self.community_members[community_id] = json.dumps(members)

    def _get_proposal_pulses(self, proposal_id: str) -> list:
        raw = self.proposal_pulses.get(proposal_id)
        return [] if raw is None else json.loads(raw)

    def _set_proposal_pulses(self, proposal_id: str, addresses: list) -> None:
        self.proposal_pulses[proposal_id] = json.dumps(addresses)

    def _is_member(self, community_id: str, address: str) -> bool:
        return address in self._get_community_members(community_id)

    def _sender(self) -> str:
        return gl.message.sender_address.as_hex

    def _pay(self, to_address: str, amount: int) -> None:
        target = gl.get_contract_at(Address(to_address))
        target.emit_transfer(value=amount)

    def _validate_score_fields(self, result_json: dict, funding_threshold: int) -> dict:
        recommendation = result_json.get("recommendation")
        if recommendation not in ("FUND", "REVISE", "REJECT"):
            recommendation = "REJECT"

        def clamp_score(val, default=0):
            if val is None:
                return default
            try:
                v = int(val)
                return max(0, min(100, v))
            except (TypeError, ValueError):
                return default

        base_score = clamp_score(result_json.get("base_score"), 0)
        pulse_bonus = clamp_score(result_json.get("pulse_bonus"), 0)
        total_score = clamp_score(result_json.get("total_score"), 0)

        if recommendation == "FUND" and total_score < funding_threshold:
            recommendation = "REJECT"
        if recommendation == "REJECT" and total_score >= funding_threshold:
            recommendation = "REJECT"
        if recommendation == "REVISE" and total_score >= funding_threshold:
            recommendation = "FUND"

        raw_principles = result_json.get("principle_scores")
        if not isinstance(raw_principles, dict):
            raw_principles = {}

        principle_scores = {
            "purpose_alignment":  clamp_score(raw_principles.get("purpose_alignment")),
            "community_benefit":  clamp_score(raw_principles.get("community_benefit")),
            "constitutional_fit": clamp_score(raw_principles.get("constitutional_fit")),
            "feasibility":        clamp_score(raw_principles.get("feasibility")),
            "value_for_money":    clamp_score(raw_principles.get("value_for_money")),
        }

        reasoning = result_json.get("reasoning") or ""
        if not isinstance(reasoning, str):
            reasoning = str(reasoning)

        concerns = result_json.get("concerns") or ""
        if not isinstance(concerns, str):
            concerns = str(concerns)

        return {
            "base_score":       base_score,
            "pulse_bonus":      pulse_bonus,
            "total_score":      total_score,
            "principle_scores": principle_scores,
            "recommendation":   recommendation,
            "reasoning":        reasoning,
            "concerns":         concerns,
        }

    def _reserve_funds(self, community: dict, proposal: dict) -> dict:
        """
        Deduct the FULL proposal amount from pot_balance on approval.
        Caller MUST have already re-read `community` fresh (see FIX 2b)
        immediately before calling this, so the deduction is against
        current state, not a stale pre-AI-call snapshot.
        """
        upfront_pct = community["upfront_release_pct"]
        upfront_amount = (proposal["amount"] * upfront_pct) // 100
        escrowed_amount = proposal["amount"] - upfront_amount

        community["pot_balance"] = community["pot_balance"] - proposal["amount"]
        if community["pot_balance"] < 0:
            community["pot_balance"] = 0
        if community["pot_balance"] == 0:
            community["status"] = "depleted"

        proposal["upfront_amount"] = upfront_amount
        proposal["upfront_paid"] = upfront_amount
        proposal["escrowed_amount"] = escrowed_amount

        return community

    # ----------------------------------------------------------------
    # Public write methods
    # ----------------------------------------------------------------

    @gl.public.write.payable
    def create_community(
        self,
        founder_name: str,
        community_name: str,
        description: str,
        constitution_purpose: str,
        constitution_always_fund: str,
        constitution_never_fund: str,
        constitution_who_benefits: str,
        constitution_success: str,
        funding_threshold: str,
        max_proposal_pct: str,
        proposal_fee: str,
        upfront_release_pct: str
    ) -> str:
        founder_address = self._sender()
        pot = gl.message.value

        if pot <= 0:
            raise gl.vm.UserError("A community must be founded with a nonzero starting pot")

        threshold = int(funding_threshold)
        max_pct = int(max_proposal_pct)
        fee = int(proposal_fee)
        upfront_pct = int(upfront_release_pct)

        if threshold < 1 or threshold > 100:
            raise gl.vm.UserError("funding_threshold must be between 1 and 100")
        if max_pct < 1 or max_pct > 100:
            raise gl.vm.UserError("max_proposal_pct must be between 1 and 100")
        if upfront_pct < 0 or upfront_pct > 100:
            raise gl.vm.UserError("upfront_release_pct must be between 0 and 100")
        if fee < 0:
            raise gl.vm.UserError("proposal_fee must be >= 0")

        community_id = self._make_community_id()

        community = {
            "id": community_id,
            "name": community_name,
            "description": description,
            "founder": founder_address,
            "founder_name": founder_name,
            "constitution": {
                "purpose": constitution_purpose,
                "always_fund": constitution_always_fund,
                "never_fund": constitution_never_fund,
                "who_benefits": constitution_who_benefits,
                "success_looks_like": constitution_success,
            },
            "pot_balance": pot,
            "funding_threshold": threshold,
            "max_proposal_pct": max_pct,
            "proposal_fee": fee,
            "upfront_release_pct": upfront_pct,
            "member_count": 1,
            "proposal_count": 0,
            "funded_count": 0,
            "completed_count": 0,
            "total_funded": 0,
            "status": "active",
            "created_at": int(self.community_count),
        }

        self._write_community(community_id, community)
        self._set_community_proposals(community_id, [])
        self._set_community_members(community_id, [founder_address])

        return community_id

    @gl.public.write
    def join_community(self, community_id: str, member_name: str) -> None:
        member_address = self._sender()
        community = self._read_community(community_id)

        if community["status"] != "active":
            return

        members = self._get_community_members(community_id)
        if member_address in members:
            return

        members.append(member_address)
        self._set_community_members(community_id, members)
        community["member_count"] = community["member_count"] + 1
        self._write_community(community_id, community)

    @gl.public.write.payable
    def deposit_funds(self, community_id: str) -> None:
        amt = gl.message.value
        if amt <= 0:
            raise gl.vm.UserError("Deposit must be greater than zero")

        community = self._read_community(community_id)
        community["pot_balance"] = community["pot_balance"] + amt
        if community["status"] == "depleted" and community["pot_balance"] > 0:
            community["status"] = "active"
        self._write_community(community_id, community)

    @gl.public.write.payable
    def submit_proposal(
        self,
        community_id: str,
        proposer_name: str,
        title: str,
        amount: str,
        what_it_does: str,
        who_it_helps: str,
        success_metric: str,
        timeline: str
    ) -> str:
        proposer_address = self._sender()
        community = self._read_community(community_id)

        if not self._is_member(community_id, proposer_address):
            raise gl.vm.UserError("Only community members can submit proposals")

        fee = community["proposal_fee"]
        if gl.message.value < fee:
            raise gl.vm.UserError(
                f"This community requires a proposal fee of {fee}"
            )

        amt = int(amount)
        max_allowed = (community["pot_balance"] * community["max_proposal_pct"]) // 100
        if amt <= 0 or amt > max_allowed:
            raise gl.vm.UserError(
                f"Amount must be between 1 and {max_allowed}"
            )

        proposal_id = self._make_proposal_id()

        community["pot_balance"] = community["pot_balance"] + gl.message.value
        community["proposal_count"] = community["proposal_count"] + 1
        self._write_community(community_id, community)

        proposal = {
            "id": proposal_id,
            "community_id": community_id,
            "proposer": proposer_address,
            "proposer_name": proposer_name,
            "title": title,
            "amount": amt,
            "what_it_does": what_it_does,
            "who_it_helps": who_it_helps,
            "success_metric": success_metric,
            "timeline": timeline,
            "status": "pending",
            "is_revision": False,
            "original_proposal_id": None,
            "pulse_count": 0,
            "pulse_bonus": 0,
            "base_score": None,
            "total_score": None,
            "principle_scores": {
                "purpose_alignment": None,
                "community_benefit": None,
                "constitutional_fit": None,
                "feasibility": None,
                "value_for_money": None,
            },
            "recommendation": None,
            "reasoning": None,
            "concerns": None,
            "revision_count": 0,
            "upfront_amount": 0,
            "upfront_paid": 0,
            "escrowed_amount": 0,
            "completion_evidence_type": "",
            "completion_evidence_url": "",
            "completion_evidence_description": "",
            "completion_delivered": None,
            "completion_reasoning": "",
            "completion_resubmission_count": 0,
            "created_at": int(self.proposal_count),
        }

        self._write_proposal(proposal_id, proposal)
        self._set_proposal_pulses(proposal_id, [])

        community_props = self._get_community_proposals(community_id)
        community_props.append(proposal_id)
        self._set_community_proposals(community_id, community_props)

        member_props = self._get_member_proposals(proposer_address)
        member_props.append(proposal_id)
        self._set_member_proposals(proposer_address, member_props)

        return proposal_id

    @gl.public.write
    def add_pulse(self, proposal_id: str) -> None:
        member_address = self._sender()
        proposal = self._read_proposal(proposal_id)

        if proposal["status"] not in ("pending", "scoring"):
            return

        if not self._is_member(proposal["community_id"], member_address):
            return

        pulses = self._get_proposal_pulses(proposal_id)
        if member_address in pulses:
            return

        pulses.append(member_address)
        self._set_proposal_pulses(proposal_id, pulses)
        proposal["pulse_count"] = proposal["pulse_count"] + 1
        self._write_proposal(proposal_id, proposal)

    @gl.public.write
    def evaluate_proposal(self, proposal_id: str) -> None:
        proposal = self._read_proposal(proposal_id)

        if proposal["status"] != "pending":
            return

        community_id = proposal["community_id"]
        community = self._read_community(community_id)

        proposal["status"] = "scoring"
        self._write_proposal(proposal_id, proposal)

        constitution = community["constitution"]
        pot_balance = community["pot_balance"]
        member_count = community["member_count"]
        funding_threshold = community["funding_threshold"]
        pulse_count = proposal["pulse_count"]
        proposal_amount = proposal["amount"]

        prompt = (
            "You are evaluating a funding proposal for a community treasury.\n\n"
            "COMMUNITY CONSTITUTION:\n"
            "Purpose: " + constitution["purpose"] + "\n"
            "We always fund: " + constitution["always_fund"] + "\n"
            "We never fund: " + constitution["never_fund"] + "\n"
            "Who benefits: " + constitution["who_benefits"] + "\n"
            "Success looks like: " + constitution["success_looks_like"] + "\n\n"
            "PROPOSAL:\n"
            "Title: " + proposal["title"] + "\n"
            "Amount requested: " + str(proposal_amount) +
            " (total pot: " + str(pot_balance) + ")\n"
            "What it does: " + proposal["what_it_does"] + "\n"
            "Who it helps: " + proposal["who_it_helps"] + "\n"
            "Success metric: " + proposal["success_metric"] + "\n"
            "Timeline: " + proposal["timeline"] + "\n"
            "Community pulse signals: " + str(pulse_count) +
            " members expressed support out of " + str(member_count) + " total members\n\n"
            "Score this proposal 0-100 on each of these five principles:\n"
            "- purpose_alignment: does it match the stated community purpose?\n"
            "- community_benefit: does it benefit the majority of members?\n"
            "- constitutional_fit: does it respect the always/never fund rules?\n"
            "- feasibility: is the timeline and success metric realistic?\n"
            "- value_for_money: is the amount reasonable for the stated outcome?\n\n"
            "base_score = average of the five principle scores (integer 0-100).\n"
            "pulse_bonus = integer 0-5 based on pulse_count relative to member_count.\n"
            "total_score = base_score + pulse_bonus. Maximum 100. Must be an integer.\n\n"
            "Recommendation rules (must follow exactly):\n"
            "- FUND if total_score >= " + str(funding_threshold) + "\n"
            "- REVISE if total_score is 50 to " + str(funding_threshold - 1) + "\n"
            "- REJECT if total_score < 50\n\n"
            "IMPORTANT: All score fields must be integers between 0 and 100. "
            "recommendation must be exactly one of: FUND, REVISE, REJECT.\n\n"
            "Return ONLY a JSON object. No markdown, no preamble, no explanation.\n"
            'Format: {"base_score": 72, "pulse_bonus": 3, "total_score": 75, '
            '"principle_scores": {"purpose_alignment": 80, "community_benefit": 75, '
            '"constitutional_fit": 90, "feasibility": 60, "value_for_money": 70}, '
            '"recommendation": "FUND", "reasoning": "one sentence", '
            '"concerns": "one sentence"}'
        )

        def generate():
            raw = gl.nondet.exec_prompt(prompt)

            result = {}
            try:
                start = raw.find("{")
                end = raw.rfind("}") + 1
                if start >= 0 and end > start:
                    result = json.loads(raw[start:end])
            except Exception:
                result = {}

            recommendation = result.get("recommendation")
            if recommendation not in ("FUND", "REVISE", "REJECT"):
                recommendation = "REJECT"

            def clamp(val, default=0):
                if val is None:
                    return default
                try:
                    v = int(val)
                    return max(0, min(100, v))
                except (TypeError, ValueError):
                    return default

            total_score = clamp(result.get("total_score"), 0)
            base_score = clamp(result.get("base_score"), 0)
            pulse_bonus = clamp(result.get("pulse_bonus"), 0)

            if recommendation == "FUND" and total_score < funding_threshold:
                recommendation = "REJECT"
            if recommendation == "REJECT" and total_score >= funding_threshold:
                recommendation = "REJECT"
            if recommendation == "REVISE" and total_score >= funding_threshold:
                recommendation = "FUND"

            raw_principles = result.get("principle_scores")
            if not isinstance(raw_principles, dict):
                raw_principles = {}

            principle_scores = {
                "purpose_alignment":  clamp(raw_principles.get("purpose_alignment")),
                "community_benefit":  clamp(raw_principles.get("community_benefit")),
                "constitutional_fit": clamp(raw_principles.get("constitutional_fit")),
                "feasibility":        clamp(raw_principles.get("feasibility")),
                "value_for_money":    clamp(raw_principles.get("value_for_money")),
            }

            reasoning = result.get("reasoning") or ""
            if not isinstance(reasoning, str):
                reasoning = str(reasoning)
            concerns = result.get("concerns") or ""
            if not isinstance(concerns, str):
                concerns = str(concerns)

            return json.dumps({
                "base_score":       base_score,
                "pulse_bonus":      pulse_bonus,
                "total_score":      total_score,
                "principle_scores": principle_scores,
                "recommendation":   recommendation,
                "reasoning":        reasoning,
                "concerns":         concerns,
            })

        result_raw = gl.eq_principle.prompt_non_comparative(
            generate,
            task="evaluate a community treasury proposal and return a validated funding verdict",
            criteria="JSON with integer scores 0-100, recommendation in (FUND/REVISE/REJECT), score consistent with recommendation"
        )

        verdict = {}
        try:
            cleaned = result_raw.replace("```json","").replace("```","").strip()
            start = cleaned.find("{")
            end = cleaned.rfind("}") + 1
            if start >= 0 and end > start:
                verdict = json.loads(cleaned[start:end])
        except Exception:
            verdict = {}

        if "total_score" not in verdict and "score" in verdict:
            verdict["total_score"] = verdict["score"]
            verdict["base_score"]  = verdict["score"]
            verdict["pulse_bonus"] = 0
        if "recommendation" not in verdict:
            verdict["recommendation"] = "REJECT"

        validated = self._validate_score_fields(verdict, funding_threshold)

        # ------------------------------------------------------------
        # FIX 2b (race guard): re-read proposal + community FRESH here,
        # immediately before committing the funding decision. Do NOT
        # reuse the `proposal`/`community` snapshots taken before the
        # multi-minute AI call above — another transaction (a different
        # proposal's evaluate_proposal / retry_payout / submit_proposal)
        # may have committed against pot_balance in the interim. Acting
        # on a stale snapshot here is exactly the double-spend / lost-
        # update risk the reviewer flagged for concurrent approvals.
        # ------------------------------------------------------------
        proposal = self._read_proposal(proposal_id)
        community = self._read_community(community_id)

        if proposal["status"] != "scoring":
            # Someone else already resolved this proposal_id concurrently
            # (shouldn't normally happen given the "scoring" status guard
            # at the top of this function, but fail safe rather than
            # clobber whatever state now exists).
            return

        proposal["base_score"]       = validated["base_score"]
        proposal["pulse_bonus"]      = validated["pulse_bonus"]
        proposal["total_score"]      = validated["total_score"]
        proposal["principle_scores"] = validated["principle_scores"]
        proposal["recommendation"]   = validated["recommendation"]
        proposal["reasoning"]        = validated["reasoning"]
        proposal["concerns"]         = validated["concerns"]

        total_score    = validated["total_score"]
        recommendation = validated["recommendation"]

        if recommendation == "FUND":
            if community["pot_balance"] >= proposal["amount"]:
                community = self._reserve_funds(community, proposal)

                if proposal["upfront_amount"] > 0:
                    self._pay(proposal["proposer"], proposal["upfront_amount"])

                community["funded_count"]  = community["funded_count"] + 1
                community["total_funded"]  = community["total_funded"] + proposal["upfront_amount"]

                proposal["status"] = (
                    "funded_partial" if proposal["escrowed_amount"] > 0 else "completed"
                )
                if proposal["status"] == "completed":
                    community["completed_count"] = community["completed_count"] + 1
            else:
                upfront_pct = community["upfront_release_pct"]
                proposal["upfront_amount"]  = (proposal["amount"] * upfront_pct) // 100
                proposal["escrowed_amount"] = proposal["amount"] - proposal["upfront_amount"]
                proposal["status"] = "approved_unfunded"

        elif total_score >= 50:
            proposal["status"] = "revision"
        else:
            proposal["status"] = "rejected"

        self._write_proposal(proposal_id, proposal)
        self._write_community(community_id, community)

    @gl.public.write
    def retry_payout(self, proposal_id: str) -> None:
        proposal = self._read_proposal(proposal_id)
        if proposal["status"] != "approved_unfunded":
            return

        community_id = proposal["community_id"]
        community = self._read_community(community_id)

        if community["pot_balance"] < proposal["amount"]:
            return

        community = self._reserve_funds(community, proposal)

        if proposal["upfront_amount"] > 0:
            self._pay(proposal["proposer"], proposal["upfront_amount"])

        community["funded_count"] = community["funded_count"] + 1
        community["total_funded"] = community["total_funded"] + proposal["upfront_amount"]

        proposal["status"] = "funded_partial" if proposal["escrowed_amount"] > 0 else "completed"
        proposal["upfront_paid"] = proposal["upfront_amount"]
        if proposal["status"] == "completed":
            community["completed_count"] = community["completed_count"] + 1

        self._write_proposal(proposal_id, proposal)
        self._write_community(community_id, community)

    @gl.public.write
    def submit_completion_evidence(
        self,
        proposal_id: str,
        evidence_type: str,
        evidence_url: str,
        evidence_description: str
    ) -> None:
        caller = self._sender()
        proposal = self._read_proposal(proposal_id)

        if proposal["proposer"] != caller:
            raise gl.vm.UserError("Only the original proposer can submit completion evidence")

        if proposal["status"] != "funded_partial":
            raise gl.vm.UserError("This proposal has no pending completion payout to release")

        allowed_types = ("github_repo", "github_file", "live_site", "ipfs")
        if evidence_type not in allowed_types:
            raise gl.vm.UserError(
                "evidence_type must be one of: github_repo, github_file, live_site, ipfs"
            )

        if not evidence_url.strip():
            raise gl.vm.UserError("A URL is required as evidence of completion")

        url = evidence_url.strip()
        if evidence_type == "github_repo" and not url.startswith("https://api.github.com/repos/"):
            raise gl.vm.UserError("github_repo evidence must use the GitHub REST API")
        if evidence_type == "github_file" and not url.startswith("https://raw.githubusercontent.com/"):
            raise gl.vm.UserError("github_file evidence must use raw.githubusercontent.com")
        if evidence_type == "ipfs" and not url.startswith("https://ipfs.io/ipfs/"):
            raise gl.vm.UserError("ipfs evidence must use the ipfs.io gateway")

        community_id    = proposal["community_id"]
        what_it_does    = proposal["what_it_does"]
        success_metric  = proposal["success_metric"]

        if evidence_type == "github_repo":
            content_hint = (
                "The fetched content is JSON from the GitHub REST API. "
                "Check repo name, description, and topics match the deliverable. "
                "A repo with zero commits or no description is not sufficient."
            )
        elif evidence_type == "github_file":
            content_hint = (
                "The fetched content is a raw file from GitHub. "
                "Check whether the file content matches what was promised."
            )
        elif evidence_type == "live_site":
            content_hint = (
                "The fetched content is raw HTML of a live website. "
                "A placeholder page, login wall, or 404 as HTML is not sufficient."
            )
        else:
            content_hint = (
                "The fetched content is a file from IPFS — immutable, cannot be altered. "
                "If content matches the deliverable, it is genuine evidence."
            )

        def generate():
            page_text = None
            try:
                response = gl.nondet.web.request(url, method="GET")
                page_text = response.body.decode("utf-8", errors="ignore")[:4000]
            except Exception as e:
                ctx = e.args[0] if e.args else {}
                if isinstance(ctx, dict):
                    body = ctx.get("body")
                    if body:
                        page_text = str(body)[:4000]

            if not page_text:
                return json.dumps({
                    "delivered": False,
                    "fetch_failed": True,
                    "reasoning": "The evidence URL could not be reached — nothing to verify."
                })

            verify_prompt = (
                "You are verifying whether a funded community proposal was delivered.\n\n"
                "WHAT WAS PROMISED:\n"
                "What it does: " + what_it_does + "\n"
                "Success metric: " + success_metric + "\n\n"
                "PROPOSER CLAIM:\n" + evidence_description[:800] + "\n\n"
                "EVIDENCE TYPE: " + evidence_type + "\n"
                + content_hint + "\n\n"
                "FETCHED CONTENT:\n" + page_text + "\nEND OF CONTENT.\n\n"
                "Judge honestly whether the fetched content is real, substantive evidence "
                "that the deliverable exists. A 404, placeholder, empty repo, or unrelated "
                "content is not sufficient.\n\n"
                "Return ONLY this JSON:\n"
                '{"delivered": <true or false>, "fetch_failed": false, '
                '"reasoning": "<one sentence citing something specific>"}'
            )

            result = gl.nondet.exec_prompt(verify_prompt)
            cleaned = result.replace("```json", "").replace("```", "").strip()

            verdict = {}
            try:
                start = cleaned.find("{")
                end = cleaned.rfind("}") + 1
                if start >= 0 and end > start:
                    verdict = json.loads(cleaned[start:end])
            except Exception:
                verdict = {}

            delivered = verdict.get("delivered")
            if not isinstance(delivered, bool):
                delivered = False
            fetch_failed = verdict.get("fetch_failed")
            if not isinstance(fetch_failed, bool):
                fetch_failed = False
            reasoning = verdict.get("reasoning") or "No reasoning returned."
            if not isinstance(reasoning, str):
                reasoning = str(reasoning)

            return json.dumps({
                "delivered":   delivered,
                "fetch_failed": fetch_failed,
                "reasoning":   reasoning,
            })

        result_raw = gl.eq_principle.prompt_non_comparative(
            generate,
            task="verify whether fetched live content substantiates a claimed proposal deliverable",
            criteria="JSON with delivered (bool), fetch_failed (bool), and reasoning (string)"
        )

        verdict = {}
        try:
            start = result_raw.find("{")
            end = result_raw.rfind("}") + 1
            if start >= 0 and end > start:
                verdict = json.loads(result_raw[start:end])
        except Exception:
            verdict = {}

        delivered    = verdict.get("delivered", False)
        fetch_failed = verdict.get("fetch_failed", False)
        reasoning    = verdict.get("reasoning") or "No verification reasoning returned."

        if not isinstance(delivered, bool):
            delivered = False
        if not isinstance(fetch_failed, bool):
            fetch_failed = False
        if not isinstance(reasoning, str):
            reasoning = str(reasoning)

        # FIX 2b (race guard): fresh read right before commit — see
        # evaluate_proposal above for the rationale.
        proposal = self._read_proposal(proposal_id)
        community = self._read_community(community_id)

        if proposal["status"] != "funded_partial":
            # State moved concurrently (e.g. proposer somehow resubmitted
            # evidence twice in flight). Don't clobber — bail out.
            return

        proposal["completion_evidence_type"]        = evidence_type
        proposal["completion_evidence_url"]         = evidence_url
        proposal["completion_evidence_description"] = evidence_description
        proposal["completion_delivered"]            = delivered
        proposal["completion_reasoning"]            = reasoning

        if delivered:
            escrowed = proposal["escrowed_amount"]
            if escrowed > 0:
                self._pay(proposal["proposer"], escrowed)
                community["total_funded"] = community["total_funded"] + escrowed
            proposal["status"]          = "completed"
            proposal["escrowed_amount"] = 0
            community["completed_count"] = community["completed_count"] + 1
            self._write_community(community_id, community)

        elif fetch_failed:
            proposal["status"] = "funded_partial"

        else:
            if proposal["completion_resubmission_count"] == 0:
                proposal["completion_resubmission_count"] = 1
                proposal["status"] = "funded_partial"
            else:
                escrowed = proposal["escrowed_amount"]
                community["pot_balance"]    = community["pot_balance"] + escrowed
                proposal["escrowed_amount"] = 0
                proposal["status"]          = "completion_failed"
                self._write_community(community_id, community)

        self._write_proposal(proposal_id, proposal)

    @gl.public.write
    def revise_proposal(
        self,
        original_proposal_id: str,
        title: str,
        amount: str,
        what_it_does: str,
        who_it_helps: str,
        success_metric: str,
        timeline: str
    ) -> str:
        proposer_address = self._sender()
        original = self._read_proposal(original_proposal_id)

        if original["proposer"] != proposer_address:
            raise gl.vm.UserError("Only the original proposer can revise this proposal")
        if original["status"] != "revision":
            raise gl.vm.UserError("This proposal is not open for revision")
        if original["revision_count"] != 0:
            raise gl.vm.UserError("This proposal has already used its one revision")

        community_id = original["community_id"]
        community    = self._read_community(community_id)

        amt = int(amount)
        max_allowed = (community["pot_balance"] * community["max_proposal_pct"]) // 100
        if amt <= 0 or amt > max_allowed:
            raise gl.vm.UserError(f"Amount must be between 1 and {max_allowed}")

        original["revision_count"] = 1
        self._write_proposal(original_proposal_id, original)

        community["proposal_count"] = community["proposal_count"] + 1
        self._write_community(community_id, community)

        proposal_id = self._make_proposal_id()

        proposal = {
            "id": proposal_id,
            "community_id": community_id,
            "proposer": proposer_address,
            "proposer_name": original["proposer_name"],
            "title": title,
            "amount": amt,
            "what_it_does": what_it_does,
            "who_it_helps": who_it_helps,
            "success_metric": success_metric,
            "timeline": timeline,
            "status": "pending",
            "is_revision": True,
            "original_proposal_id": original_proposal_id,
            "pulse_count": 0,
            "pulse_bonus": 0,
            "base_score": None,
            "total_score": None,
            "principle_scores": {
                "purpose_alignment": None,
                "community_benefit": None,
                "constitutional_fit": None,
                "feasibility":        None,
                "value_for_money":    None,
            },
            "recommendation": None,
            "reasoning": None,
            "concerns":  None,
            "revision_count": 0,
            "upfront_amount": 0,
            "upfront_paid":   0,
            "escrowed_amount": 0,
            "completion_evidence_type":        "",
            "completion_evidence_url":         "",
            "completion_evidence_description": "",
            "completion_delivered":            None,
            "completion_reasoning":            "",
            "completion_resubmission_count":   0,
            "created_at": int(self.proposal_count),
        }

        self._write_proposal(proposal_id, proposal)
        self._set_proposal_pulses(proposal_id, [])

        community_props = self._get_community_proposals(community_id)
        community_props.append(proposal_id)
        self._set_community_proposals(community_id, community_props)

        member_props = self._get_member_proposals(proposer_address)
        member_props.append(proposal_id)
        self._set_member_proposals(proposer_address, member_props)

        return proposal_id

    # ----------------------------------------------------------------
    # Public view methods
    # ----------------------------------------------------------------

    @gl.public.view
    def get_community(self, community_id: str) -> str:
        if community_id not in self.communities:
            return json.dumps({"error": "Community not found"})
        return self.communities[community_id]

    @gl.public.view
    def get_proposal(self, proposal_id: str) -> str:
        if proposal_id not in self.proposals:
            return json.dumps({"error": "Proposal not found"})
        return self.proposals[proposal_id]

    @gl.public.view
    def get_community_proposals(self, community_id: str) -> str:
        ids = self._get_community_proposals(community_id)
        result = []
        for pid in ids:
            raw = self.proposals.get(pid)
            if raw is not None:
                result.append(json.loads(raw))
        return json.dumps(result)

    @gl.public.view
    def get_funded_proposals(self, community_id: str) -> str:
        ids = self._get_community_proposals(community_id)
        result = []
        for pid in ids:
            raw = self.proposals.get(pid)
            if raw is not None:
                p = json.loads(raw)
                if p["status"] in ("funded_partial", "completed"):
                    result.append(p)
        return json.dumps(result)

    @gl.public.view
    def get_my_proposals(self, address: str) -> str:
        ids = self._get_member_proposals(address)
        result = []
        for pid in ids:
            raw = self.proposals.get(pid)
            if raw is not None:
                result.append(json.loads(raw))
        return json.dumps(result)

    @gl.public.view
    def get_community_members(self, community_id: str) -> str:
        return json.dumps(self._get_community_members(community_id))

    @gl.public.view
    def get_recent_communities(self, limit: int) -> str:
        result = []
        total = int(self.community_count)
        for n in range(total, 0, -1):
            if len(result) >= limit:
                break
            community_id = "COM" + str(n).zfill(6)
            raw = self.communities.get(community_id)
            if raw is not None:
                result.append(json.loads(raw))
        return json.dumps(result)

    @gl.public.view
    def get_contract_balance(self) -> str:
        return str(self.balance)
