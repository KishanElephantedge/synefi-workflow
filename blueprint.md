# Synefi Outreach Automation — Blueprint

Client: Synefi (https://synefi.com/) — "Safe Agentic AI for Regulated Industries" (pharma, healthcare, medical device).

Goal: build an always-on tool/agent that continuously finds companies showing intent to build AI/automation, prioritizes them, identifies the right decision-maker, enriches contact data, designs the best outreach approach, and sends outreach — running as a standing pipeline, not a one-shot run.

Available building blocks (custom vs. tool vs. hybrid to be decided per phase, based on cost/speed/reliability/complexity/performance):
- Deepline (code.deepline.com) — Agent-Native API for GTM, orchestrated via Claude Code slash commands (e.g. `/deepline-gtm`). Recipes include Waterfall Email Lookup, Signal-Based Outbound, VC Portfolio Scrape, copy generation/evaluation, campaign push (e.g. to Instantly).
- HeyReach — LinkedIn outreach sequencing/sending.
- Custom code — for anything the above can't do well or cost-effectively.

ICP (starting point): regulated industries — pharma, healthcare, medtech. Expand only if the team lead says to go broader.

---

## Phase 0 — Foundations (not a runtime phase; prerequisite work folded into Phase 1 & 2 as we build them)
- Confirm ICP details: sub-segments, company size range, geography (if any).
- Research and rank candidate "signals" of AI/agentic buying intent, scoped to the ICP (hiring for tech roles, AI PMs, founding recruiters, AI consultants, workshop hosts/attendees, and others found via research), ranked by how strongly each predicts real intent.
- Decide build vs. Deepline vs. HeyReach vs. hybrid for each subsequent phase.

## Phase 1 — Signal Discovery (continuous)
- Scan LinkedIn (only source for now) on a recurring cadence for the ranked signals from Phase 0.
- Output: raw list of companies + the specific signal(s) that triggered a hit, per cycle.

## Phase 2 — Company Scoring & Prioritization
- Score/rank discovered companies using a threshold model (criteria TBD — e.g. signal strength, company fit, recency, multiple-signal stacking).
- Output: prioritized queue of companies to pursue, filtering out weak/noise hits.

## Phase 3 — Decision-Maker Identification
- For each qualifying company, determine who the actual right person to reach is — not just a persona/title match, but who plausibly owns budget/decision for this kind of purchase (may vary by company size/structure).
- Output: one (or a small ranked set of) target contact(s) per company.

## Phase 4 — Enrichment & Approach Design
- Pull contact data (email, LinkedIn, other channels) for the identified target(s).
- Determine the best channel and messaging angle per persona/company to maximize trust and acceptance (copy generation and channel choice live here).
- Output: a ready-to-send outreach package per contact.

## Phase 5 — Outreach Execution
- Send via the chosen channel(s) (LinkedIn/HeyReach, email, etc.), respecting batching/rate limits.
- Output: sent outreach, logged.

## Phase 6 — Orchestration Layer (wraps all of the above)
- Runs Phases 1–5 as a standing, always-on process on a defined cadence (hourly/daily volume — TBD), batch after batch, indefinitely — not a one-shot script.

---

## Open items (not yet decided, to resolve when we reach that phase)
- Company scoring/threshold criteria (Phase 2).
- Decision-maker identification logic (Phase 3).
- Cadence/volume for the orchestration loop (Phase 6).
- Feedback loop / reply tracking — not confirmed as in scope; revisit if team lead confirms it's wanted.
