# Synefi — Phase 4: Enrichment & Approach Design

Purpose: turn the up-to-2/3 contacts identified in Phase 3 into enriched, verified contact records plus highly personalized, ready-to-send messages per contact. Executives in Pharma/Healthcare get dozens of generic "AI development" pitches weekly — outreach that looks automated fails; it must prove specific understanding of their regulatory environment and internal resource gap.

Research grounding:
- Generic outreach gets 1–5% replies; signal-anchored personalization gets up to 18%; combined with tight ICP targeting, top teams hit 15–25%. Test for real personalization: could this message only have been sent to this one person, about this one specific thing happening at their company right now?
- Deal size drives channel choice: <$5K → email primary; $5K–$50K → multi-channel; >$50K → LinkedIn primary, email as warm-up. Senior buyers (Director/VP/C-suite — exactly Phase 3's targets) check LinkedIn but ignore cold email from unknown senders.
- Multi-channel sequencing beats single-channel by ~40% in engagement; booking a meeting typically needs 8–12 touchpoints across channels (email sweet spot: 3–4 messages).
- Compliance/Domain contacts respond to risk-mitigation framing (governance, audit trails, documented compliance readiness) — never a feature pitch.
- Gmail/Microsoft detect templated outreach via transformer models; GDPR/CAN-SPAM/state privacy laws impose real constraints on sending.

---

## Rule-1 (Full Contact Map Enrichment)
The platform's job at this step is to fetch the *complete* map of every possible way to reach the contact — not just what the platform can automate. Automatable-vs-not is decided in Rule-1b, after the map is built, not during enrichment itself.

Fetch, per contact:
- **Digital/automatable**: verified work email + LinkedIn URL, via Deepline's existing Waterfall Email Lookup recipe (already chains ContactOut, Apollo, Prospeo, Hunter, BetterContact/FullEnrich, ZeroBounce for verification) — don't hand-roll a separate provider order that duplicates this.
- **Voice**: direct mobile number / office desk line, where enrichable (e.g. via Lusha, Apollo, RocketReach — already in Deepline's provider list).
- **Physical**: company HQ address and, where identifiable, the specific office/branch the contact works from.
- **Digital footprint beyond the inbox**: Twitter/X account, personal blog/Substack, if discoverable via general web search (not LinkedIn scraping — this is public-web research, a different and lower-risk category than the LinkedIn-specific tooling discussed in signals.md).
- **Thought-leadership footprint**: recent podcast guest appearances, upcoming conference speaking slots, published papers/articles — via general web search and, where useful, niche APIs (e.g. podcast guest databases, conference agenda pages).
- If no valid/verified email is found after the waterfall, flag email as unavailable in the map rather than sending to an unverified/catch-all address.

## Rule-1b (Automation Routing — what the platform executes vs. what it hands off)
This platform automates outreach **only** through channels it can execute end-to-end: LinkedIn and email (and any other channel we confirm we can fully automate later). Everything else in the Contact Map — physical mail, phone calls, in-person/event opportunities, podcast/conference outreach — is **not executed by the platform**. It gets attached to the lead record as a ready-to-use manual outreach dossier for a human at Synefi to act on at their discretion. The platform's responsibility ends at surfacing that data cleanly, not at deciding or performing the human-executed action.

## Rule-2 (Reconnaissance — context gathering before any copy is written)
Before message generation, gather three context blocks per contact and feed them into the copy-generation step:
- **Signal Context**: the specific detail from whatever triggered Phase 1 for this contact/company (e.g. exact responsibilities pulled from the job description that fired the signal, not just "they posted a job").
- **Company Context**: a one-line LLM-generated summary of what the company actually does (e.g. "They manufacture robotic surgical arms"), so copy doesn't read as generic industry boilerplate.
- **Individual Context**: the target's LinkedIn headline and recent post activity, if available.

## Rule-3 (Channel Selection by Company Size — from Phase 3's bands)
- Seed/Small (<50 employees): email-primary, LinkedIn as secondary touch.
- Growth/Mid-Market (50–1,000): multi-channel, roughly even split.
- Enterprise (1,000+): LinkedIn-primary, email as warm-up touch.
- Operational fallback: if an email bounces, switch that contact to LinkedIn-first for the remainder of the sequence rather than retrying the same bad address.

## Rule-4 (Cadence)
LinkedIn connect (day 1) → email (day 3) → LinkedIn message (day 7) → email follow-up (day 10) — stop immediately on reply, or per Phase 3's Rule-7 suppression once contacted.

## Rule-5 (Message Construction — Observation → Value → Credibility, per thread)

**Champion / Technical thread (CTO, VP/Director/Head of AI):**
- Psychology: stressed about timelines, technical debt, finding good AI talent.
- Observation: name the exact signal (e.g. "Saw you're actively hiring for a Lead AI Engineer for the new clinical data pipeline.")
- Value: speed/build-vs-buy framing (e.g. "While you spend the next few months interviewing, Synefi can bring in a pre-vetted AI team to build the MVP now.")
- Credibility: specialization in agentic workflows integrating with regulated/healthcare infrastructure specifically — not generic AI dev capability.

**Domain/Compliance thread (CMO, Chief Compliance Officer, VP Regulatory Affairs):**
- Psychology: concerned about data leaks, hallucinations, FDA/HIPAA violations — this is risk-mitigation, not feature selling (per Phase 3's gatekeeper framing).
- Observation: reference the company's AI ramp-up generally (e.g. new hires/initiatives) rather than a specific job post, since this thread cares less about the hiring mechanic and more about the initiative's existence.
- Value: lead with what generic AI agencies miss — regulatory overhead — and how Synefi's "Safe Agentic AI" is built with audit trails, zero-retention policies, and compliance guardrails by design.
- Credibility: risk mitigation and documented governance, not speed. Never lead with AI capability/features.
- CTA: propose a joint session with both the Domain and Technical contacts together, reinforcing the internal-forwarding dynamic from Phase 3's dual-thread rule.

## Rule-6 (Execution & Guardrails)
- Copy is drafted and scored using Deepline's copy generation/evaluation recipes, with Rules 2 and 5 above as the instruction rubric fed into that step — every message is checked against personalization/framing rules before being queued to send.
- Sending must avoid templated phrasing patterns that trigger spam-filter detection, and respect GDPR/CAN-SPAM/state opt-out requirements.

---

## Output — per contact, JSON package
```
{
  "contact_map": {
    "verified_email": "...",
    "linkedin_url": "...",
    "mobile_phone": "...",
    "office_phone": "...",
    "company_hq_address": "...",
    "office_branch_address": "...",
    "twitter_x": "...",
    "blog_or_substack": "...",
    "podcast_appearances": ["..."],
    "upcoming_conference_slots": ["..."]
  },
  "automated_execution": {
    "channel_plan": "email-primary | linkedin-primary | multi-channel",
    "subject_line": "...",
    "email_body": "...",
    "linkedin_connection_note": "..."
  },
  "manual_outreach_dossier": {
    "note": "Non-automatable channels from contact_map (phone, physical mail, in-person/event) — surfaced for human action, not executed by the platform."
  },
  "thread_role": "Champion | Domain-Compliance | Economic Buyer"
}
```
`automated_execution` feeds directly into Phase 5 (Outreach Execution). `manual_outreach_dossier` is out of the platform's execution scope — a human decides whether/how to act on it.

---

## Status note
This document (like blueprint.md, signals.md, phase2-scoring.md, phase3-decision-maker.md) is a decision-complete design spec — exact rules, thresholds, and structure — not yet executable code, prompts, or a running pipeline. Translation into actual prompts/scripts/API wiring happens in the development phase, after all phases are finalized.
