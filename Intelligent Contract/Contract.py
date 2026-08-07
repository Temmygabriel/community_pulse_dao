# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *

import json


class CommunityPulse(gl.Contract):

    community_count: u256
    proposal_count: u256
    communities: TreeMap[str, str]           # community_id -> JSON
    proposals: TreeMap[str, str]             # proposal_id -> JSON
    community_proposals: TreeMap[str, str]   # community_id -> [proposal_ids] JSON
    member_proposals: TreeMap[str, str]      # address -> [proposal_ids] JSON
    community_members: TreeMap[str, str]     # community_id -> [addresses] JSON
    proposal_pulses: TreeMap[str, str]       # proposal_id -> [addresses] JSON

    def __init__(self):
        self.community_count = u256(0)
        self.proposal_count = u256(0)

    # ----------------------------------------------------------------
    # Internal helpers
    # ----------------------------------------------------------------

    def _make_community_id(self) -> str:
        self.community_count = u256(int(self.community_count) + 1)
        n = int(self.community_count)
        return "COM" + str(n).zfill(6)

    def _make_proposal_id(self) -> str:
        self.proposal_count = u256(int(self.proposal_count) + 1)
        n = int(self.proposal_count)
        return "PRO" + str(n).zfill(6)

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
        if raw is None:
            return []
        return json.loads(raw)

    def _set_community_proposals(self, community_id: str, ids: list) -> None:
        self.community_proposals[community_id] = json.dumps(ids)

    def _get_member_proposals(self, address: str) -> list:
        raw = self.member_proposals.get(address)
        if raw is None:
            return []
        return json.loads(raw)

    def _set_member_proposals(self, address: str, ids: list) -> None:
        self.member_proposals[address] = json.dumps(ids)

    def _get_community_members(self, community_id: str) -> list:
        raw = self.community_members.get(community_id)
        if raw is None:
            return []
        return json.loads(raw)

    def _set_community_members(self, community_id: str, members: list) -> None:
        self.community_members[community_id] = json.dumps(members)

    def _get_proposal_pulses(self, proposal_id: str) -> list:
        raw = self.proposal_pulses.get(proposal_id)
        if raw is None:
            return []
        return json.loads(raw)

    def _set_proposal_pulses(self, proposal_id: str, addresses: list) -> None:
        self.proposal_pulses[proposal_id] = json.dumps(addresses)

    def _is_member(self, community_id: str, address: str) -> bool:
        members = self._get_community_members(community_id)
        return address in members

    def _sender(self) -> str:
        # CONFIRMED pattern from build guide: use .as_hex, never str()
        # str(gl.message.sender_address) produces a different format and
        # is explicitly listed as wrong in the confirmed API table.
        return gl.message.sender_address.as_hex

    def _pay(self, to_address: str, amount: int) -> None:
        target = gl.get_contract_at(Address(to_address))
        target.emit_transfer(value=amount)

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

        community_id = self._make_community_id()

        threshold = int(funding_threshold)
        max_pct = int(max_proposal_pct)
        fee = int(proposal_fee)
        upfront_pct = int(upfront_release_pct)

        if upfront_pct < 0 or upfront_pct > 100:
            raise gl.vm.UserError("upfront_release_pct must be between 0 and 100")

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
    def join_community(
        self,
        community_id: str,
        member_name: str
    ) -> None:
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
    def deposit_funds(
        self,
        community_id: str
    ) -> None:
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
                f"This community requires a proposal fee of {fee} — sent value was too low"
            )

        amt = int(amount)
        max_allowed = (community["pot_balance"] * community["max_proposal_pct"]) // 100
        if amt <= 0 or amt > max_allowed:
            raise gl.vm.UserError(
                f"Amount requested must be between 1 and {max_allowed} (max_proposal_pct of the current pot)"
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
    def add_pulse(
        self,
        proposal_id: str
    ) -> None:
        member_address = self._sender()
        proposal = self._read_proposal(proposal_id)

        if proposal["status"] not in ("pending", "scoring", "scored"):
            return

        community_id = proposal["community_id"]

        if not self._is_member(community_id, member_address):
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
            "Amount requested: " + str(proposal["amount"]) +
            " (total pot: " + str(pot_balance) + ")\n"
            "What it does: " + proposal["what_it_does"] + "\n"
            "Who it helps: " + proposal["who_it_helps"] + "\n"
            "Success metric: " + proposal["success_metric"] + "\n"
            "Timeline: " + proposal["timeline"] + "\n"
            "Community pulse signals: " + str(proposal["pulse_count"]) +
            " members expressed support out of " + str(member_count) + " total members\n\n"
            "Score this proposal 0-100 on each of these five principles:\n"
            "- purpose_alignment: does it match the stated community purpose?\n"
            "- community_benefit: does it benefit the majority of members?\n"
            "- constitutional_fit: does it respect the always/never fund rules?\n"
            "- feasibility: is the timeline and success metric realistic?\n"
            "- value_for_money: is the amount reasonable for the stated outcome?\n\n"
            "Base score = average of the five principle scores.\n"
            "Pulse bonus = up to 5 points based on pulse_count relative to member count.\n"
            "Total score = base score + pulse bonus. Maximum 100.\n\n"
            "Recommendation rules:\n"
            "- FUND if total_score >= " + str(funding_threshold) + "\n"
            "- REVISE if total_score is 50 to " + str(funding_threshold - 1) + "\n"
            "- REJECT if total_score < 50\n\n"
            "Return ONLY a JSON object starting with { and ending with }. "
            "No markdown, no preamble.\n"
            'Format: {"base_score": 72, "pulse_bonus": 3, "total_score": 75, '
            '"principle_scores": {"purpose_alignment": 80, "community_benefit": 75, '
            '"constitutional_fit": 90, "feasibility": 60, "value_for_money": 70}, '
            '"recommendation": "FUND", "reasoning": "one sentence explaining verdict", '
            '"concerns": "one sentence on what is weak or missing"}'
        )

        def generate():
            return gl.nondet.exec_prompt(prompt)

        result_raw = gl.eq_principle.prompt_non_comparative(
            generate,
            task="evaluate a community treasury funding proposal against a constitution",
            criteria="valid JSON with base_score, pulse_bonus, total_score, principle_scores, recommendation, reasoning, and concerns"
        )

        result_json = {}
        try:
            start = result_raw.find("{")
            end = result_raw.rfind("}") + 1
            if start >= 0 and end > start:
                result_json = json.loads(result_raw[start:end])
        except Exception:
            result_json = {}

        total_score = result_json.get("total_score", 0)
        if total_score is None:
            total_score = 0
        base_score = result_json.get("base_score", 0)
        if base_score is None:
            base_score = 0
        pulse_bonus = result_json.get("pulse_bonus", 0)
        if pulse_bonus is None:
            pulse_bonus = 0
        principle_scores = result_json.get("principle_scores", {})
        if principle_scores is None:
            principle_scores = {}
        recommendation = result_json.get("recommendation", "REJECT")
        if recommendation is None:
            recommendation = "REJECT"
        reasoning = result_json.get("reasoning", "")
        if reasoning is None:
            reasoning = ""
        concerns = result_json.get("concerns", "")
        if concerns is None:
            concerns = ""

        proposal = self._read_proposal(proposal_id)
        community = self._read_community(community_id)

        proposal["base_score"] = base_score
        proposal["pulse_bonus"] = pulse_bonus
        proposal["total_score"] = total_score
        proposal["principle_scores"] = principle_scores
        proposal["recommendation"] = recommendation
        proposal["reasoning"] = reasoning
        proposal["concerns"] = concerns

        funding_threshold = community["funding_threshold"]

        if total_score >= funding_threshold:
            upfront_pct = community["upfront_release_pct"]
            upfront_amount = (proposal["amount"] * upfront_pct) // 100
            escrowed_amount = proposal["amount"] - upfront_amount

            if community["pot_balance"] >= upfront_amount:
                if upfront_amount > 0:
                    self._pay(proposal["proposer"], upfront_amount)
                community["pot_balance"] = community["pot_balance"] - upfront_amount
                community["funded_count"] = community["funded_count"] + 1
                community["total_funded"] = community["total_funded"] + upfront_amount
                if community["pot_balance"] <= 0:
                    community["status"] = "depleted"

                proposal["status"] = "funded_partial" if escrowed_amount > 0 else "completed"
                proposal["upfront_amount"] = upfront_amount
                proposal["upfront_paid"] = upfront_amount
                proposal["escrowed_amount"] = escrowed_amount
                if escrowed_amount == 0:
                    community["completed_count"] = community["completed_count"] + 1
            else:
                proposal["status"] = "approved_unfunded"
                proposal["upfront_amount"] = upfront_amount
                proposal["escrowed_amount"] = escrowed_amount
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

        upfront_amount = proposal["upfront_amount"]
        if community["pot_balance"] < upfront_amount:
            return

        if upfront_amount > 0:
            self._pay(proposal["proposer"], upfront_amount)
        community["pot_balance"] = community["pot_balance"] - upfront_amount
        community["funded_count"] = community["funded_count"] + 1
        community["total_funded"] = community["total_funded"] + upfront_amount
        if community["pot_balance"] <= 0:
            community["status"] = "depleted"

        proposal["status"] = "funded_partial" if proposal["escrowed_amount"] > 0 else "completed"
        proposal["upfront_paid"] = upfront_amount
        if proposal["escrowed_amount"] == 0:
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
        """
        evidence_type must be one of four confirmed-working categories
        (validated via real on-chain fetch tests against studionet validators):

          github_repo  — https://api.github.com/repos/{owner}/{repo}
                         Fetches structured JSON. AI checks repo name/description
                         matches the claimed deliverable.

          github_file  — https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{file}
                         Fetches raw file bytes. AI checks file content matches
                         the claimed deliverable.

          live_site    — Any server-rendered URL (plain HTML, no JS required).
                         Works for: custom domains, Hacker News-style apps, etc.
                         Does NOT work for: React/Next.js SPAs, GitHub HTML pages,
                         dev.to, Hashnode — all confirmed to return empty shells.

          ipfs         — https://ipfs.io/ipfs/{CID}[/path]
                         Immutable content, cannot be taken down after payout.
                         Only ipfs.io gateway confirmed working; cloudflare-ipfs
                         is blocked from studionet validators.

        Any other evidence_type raises an error — open-ended URL verification
        is explicitly excluded after testing showed it produces unreliable results.
        """
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

        # URL prefix validation — catch obviously wrong URLs early before
        # spending a validator consensus round on a guaranteed fetch failure.
        url = evidence_url.strip()
        if evidence_type == "github_repo" and not url.startswith("https://api.github.com/repos/"):
            raise gl.vm.UserError(
                "github_repo evidence must use the GitHub REST API: https://api.github.com/repos/{owner}/{repo}"
            )
        if evidence_type == "github_file" and not url.startswith("https://raw.githubusercontent.com/"):
            raise gl.vm.UserError(
                "github_file evidence must use raw.githubusercontent.com: https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{file}"
            )
        if evidence_type == "ipfs" and not url.startswith("https://ipfs.io/ipfs/"):
            raise gl.vm.UserError(
                "ipfs evidence must use the ipfs.io gateway: https://ipfs.io/ipfs/{CID}"
            )

        community_id = proposal["community_id"]
        what_it_does = proposal["what_it_does"]
        success_metric = proposal["success_metric"]

        # Build a category-specific context hint for the AI verifier so it
        # knows what kind of content to expect and what counts as real evidence.
        if evidence_type == "github_repo":
            content_hint = (
                "The fetched content is JSON from the GitHub REST API describing a repository. "
                "Check whether the repository name, description, and topics match what was promised. "
                "A repo with zero commits, no description, or a name unrelated to the deliverable is not sufficient evidence."
            )
        elif evidence_type == "github_file":
            content_hint = (
                "The fetched content is the raw bytes of a file from a GitHub repository. "
                "Check whether the file content matches what was described as the deliverable — "
                "not just that a file exists, but that its content is substantively related to what was promised."
            )
        elif evidence_type == "live_site":
            content_hint = (
                "The fetched content is the raw HTML of a live website. "
                "Check whether the page content matches what was promised — "
                "not just that a page loads, but that it contains real, relevant content related to the deliverable. "
                "A placeholder page, login wall, or 404 rendered as HTML is not sufficient."
            )
        else:
            content_hint = (
                "The fetched content is a file retrieved from IPFS — an immutable, content-addressed store. "
                "Check whether the content matches what was promised as the deliverable. "
                "IPFS content cannot be altered after pinning, so if the content matches, it is genuine evidence."
            )

        def generate():
            page_text = None
            try:
                response = gl.nondet.web.request(url, method="GET")
                page_text = response.body.decode("utf-8", errors="ignore")[:4000]
            except Exception as e:
                # Validator-safe pattern: catch bare Exception, inspect e.args[0]
                # as a plain dict via builtins only. Never import GenLayer internal
                # exception classes — different validators can have different
                # availability, causing real cross-validator consensus splits.
                ctx = e.args[0] if e.args else {}
                if isinstance(ctx, dict):
                    body = ctx.get("body")
                    if body:
                        page_text = str(body)[:4000]

            if not page_text:
                return json.dumps({
                    "delivered": False,
                    "fetch_failed": True,
                    "reasoning": "The evidence URL could not be reached — nothing to verify against. This may be a temporary network issue, not necessarily a sign the work was not done."
                })

            verify_prompt = f"""You are verifying whether a funded community proposal was actually delivered.

WHAT WAS PROMISED:
What it does: {what_it_does}
Success metric: {success_metric}

PROPOSER'S CLAIM ABOUT WHAT THEY BUILT:
{evidence_description[:800]}

EVIDENCE TYPE: {evidence_type}
{content_hint}

LIVE CONTENT FETCHED FROM THE EVIDENCE URL:
{page_text}
END OF FETCHED CONTENT.

Judge honestly whether the fetched content is real, substantive evidence that what was promised
actually exists and roughly matches the claim. Do not require perfection; require genuine,
verifiable existence of the core deliverable. A 404, empty shell, placeholder, or content
entirely unrelated to the claim is not sufficient.

Return ONLY this JSON, nothing else:
{{"delivered": <true or false>, "fetch_failed": false, "reasoning": "<one sentence citing something specific you found or did not find in the fetched content>"}}"""

            result = gl.nondet.exec_prompt(verify_prompt)
            return result.replace("```json", "").replace("```", "")

        result_raw = gl.eq_principle.prompt_non_comparative(
            generate,
            task="verify whether fetched live content substantiates a claimed proposal deliverable",
            criteria="a JSON object with delivered (bool) and reasoning (string) fields",
        )

        result_json = {}
        try:
            start = result_raw.find("{")
            end = result_raw.rfind("}") + 1
            if start >= 0 and end > start:
                result_json = json.loads(result_raw[start:end])
        except Exception:
            result_json = {}

        delivered = result_json.get("delivered", False)
        if delivered is None:
            delivered = False
        fetch_failed = result_json.get("fetch_failed", False)
        if fetch_failed is None:
            fetch_failed = False
        verify_reasoning = result_json.get("reasoning")
        if not verify_reasoning:
            verify_reasoning = "No verification reasoning was returned."

        proposal = self._read_proposal(proposal_id)
        community = self._read_community(community_id)

        proposal["completion_evidence_type"] = evidence_type
        proposal["completion_evidence_url"] = evidence_url
        proposal["completion_evidence_description"] = evidence_description
        proposal["completion_delivered"] = delivered
        proposal["completion_reasoning"] = verify_reasoning

        if delivered:
            escrowed = proposal["escrowed_amount"]
            if escrowed > 0:
                self._pay(proposal["proposer"], escrowed)
                community["total_funded"] = community["total_funded"] + escrowed
            proposal["status"] = "completed"
            proposal["escrowed_amount"] = 0
            community["completed_count"] = community["completed_count"] + 1
            self._write_community(community_id, community)
        elif fetch_failed:
            # Technical failure to reach URL: don't burn the resubmission count.
            # Known accepted limitation: a URL that keeps failing indefinitely
            # can retry forever — flagged and accepted, not solved.
            proposal["status"] = "funded_partial"
        else:
            if proposal["completion_resubmission_count"] == 0:
                proposal["completion_resubmission_count"] = 1
                proposal["status"] = "funded_partial"
            else:
                escrowed = proposal["escrowed_amount"]
                community["pot_balance"] = community["pot_balance"] + escrowed
                proposal["escrowed_amount"] = 0
                proposal["status"] = "completion_failed"
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
        community = self._read_community(community_id)

        amt = int(amount)
        max_allowed = (community["pot_balance"] * community["max_proposal_pct"]) // 100
        if amt <= 0 or amt > max_allowed:
            raise gl.vm.UserError(f"Amount requested must be between 1 and {max_allowed}")

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
        members = self._get_community_members(community_id)
        return json.dumps(members)

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
