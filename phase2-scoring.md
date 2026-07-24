# Synefi — Phase 2: Company Scoring & Prioritization

Purpose: take the raw list of companies + signals from Phase 1 and turn it into a ranked, tiered queue — so limited outreach capacity (especially on LinkedIn) goes to the highest-intent, best-fit companies first, and weak/noise hits get filtered out before they waste Phase 3/4 enrichment effort.

Execution: this ruleset is applied by Claude, per company, against the rubric below — taking that company's signal list, dates, and firmographic data as input, and returning a score, tier, and short justification, logged for audit.

---

## Rule-1 (Hard Fit Gate) — REMOVED (v2)

Originally: company industry must be one of Pharma/Biotech/Medical Devices/Hospitals & Health Care, or excluded entirely before scoring.

Removed because Phase 1 discovery itself is no longer industry-gated — the manual process this pipeline replicates was never restricted to regulated industries (see `deepline/data/july-worksheet-14-companies`), it followed the AI-hiring signal wherever it led. Industry fit is now a *scored* factor only, via Component B's sub-industry fit tier below — a non-regulated company with a strong signal can still reach Hot/Warm, just capped lower on Fit. Component D (Compliance Complexity) naturally scores 0 for non-regulated companies, which is correct — Synefi's compliance moat genuinely doesn't apply there.

---

## Scoring Rubric (applied only to companies that pass Rule-1)

### A. Signal Strength (max 40 pts, recency-decayed)
Take the highest applicable value if multiple signal types fire; do not sum duplicates within this component.
- AI Leadership job post (VP/Director/Head of AI): 40 pts
- AI Builder job post (LLM/Agent Engineer, AI PM): 35 pts
- New Executive Hire (CTO, VP Eng, Head of AI within last 90 days): 30 pts
- Job post mentioning modern AI stack (LangChain, OpenAI API, LlamaIndex, etc.): 25 pts
- Executive LinkedIn commentary about AI: 20 pts
- General tech hiring (Software Engineer, PM, no AI specificity): 10 pts

**Recency decay** (applied to this component's value before it's added to the total):
- Signal age ≤ 30 days: 100% of points
- 31–60 days: 75% of points
- 61–90 days: 50% of points
- \> 90 days: 0% — dropped entirely

Example: a 40-pt AI Leadership post that fired 45 days ago contributes 30 pts (75% of 40), not 40.

### B. ICP / Company Fit (max 40 pts)
- **Sub-industry fit**: High fit (Pharma/Biotech/Medtech/Health Systems) = 20 pts; Medium fit (Fintech, Insurance, Legal, Financial Services, other adjacent regulated) = 10 pts; Low fit (everything else) = 0 pts.
- **Company size**: Sweet spot (50–500 employees) = 20 pts — large enough for budget, small enough to avoid multi-year procurement; Enterprise (500–5,000) = 15 pts — big budgets, slower deal cycles; Seed/early-stage (<50) = 5 pts — usually builds in-house, low budget.

### C. Financial / Growth Intent (max 15 pts)
Take the higher of the two, don't stack:
- Recent funding event (Series A/B/C) within last 6 months: 15 pts
- Employee headcount growth >15% year-over-year: 10 pts

### D. Regulatory Compliance Complexity (max 25 pts) — Synefi's specific moat
- Company has roles/departments matching Clinical Trials, Regulatory Affairs, Compliance Officer, Medical Writing, or Quality Assurance: +15 pts
- Active FDA pipeline (Phase I/II/III clinical trials, found via public registries or job descriptions), for Biotech/Pharma: +10 pts

**v1 status: not implemented.** Needs contact-title data (Phase 3) and an FDA pipeline lookup, neither of which exists yet. Always scores 0 until built — noted in `Score.breakdown` rather than left silent.

### E. Need-Gap: AI Greenfield vs. AI Legacy (−10 to +15 pts)
- **Greenfield** (little/no in-house AI headcount, but suddenly hiring an AI Lead/VP): +15 pts — no internal capability, must outsource to start.
- **Legacy** (already has 50+ in-house Data Scientists/ML Researchers): −10 pts — likely builds in-house, harder sell.
- Neither condition clearly met: 0 pts.

**v1 status: not implemented.** Needs in-house AI/ML headcount data, no data source wired in yet. Always scores 0 until built — noted in `Score.breakdown`.

### F. Signal Stacking Bonus (max 30 pts)
- Signals present across 2 distinct categories (e.g. a Signal Strength hit + a Compliance Complexity hit): +15 pts
- Signals present across 3+ distinct categories: +30 pts

---

## Priority Tiers (based on total score, gated companies only)

- **Hot** (score ≥ 100) → immediate outreach queue, sent directly to Phase 3
- **Warm** (score 60–99) → proceed to Phase 3, lower priority / nurture
- **Cool** (score 1–59) → back-burner, revisit as signals accumulate or decay refreshes
- **Excluded** (score 0, or failed Rule-1) → archived, not pursued

No hard cap on total score (components can sum past 100) — thresholds above are calibrated to that uncapped scale, not normalized to a flat 0–100.

---

## Rule-7 (Continuous Re-scoring + Suppression)

The pipeline runs daily, so every eligible company is rescored each cycle as new signals arrive or old ones decay past 90 days — a Cool company can become Hot the moment new signals stack, with no manual re-review needed.

**Suppression**: once a company (and the specific contact identified in Phase 3) has been sent outreach, mark them "contacted" and exclude them from being re-selected as a fresh target in future cycles. Re-engagement/follow-ups on non-responders are handled inside Phase 5's own sequencing — not by Phase 2 re-picking them as if new. A contacted company only re-enters the active discovery pool if outreach explicitly fails (bounced, wrong person) or after a defined cool-down period (default: 6 months, TBD) paired with a genuinely new Tier-1-level signal — and even then it's treated as a new cycle, not a repeat of the same approach.

---

## Open items (defaults proposed above, not locked)
- Exact point values, size band, and cool-down period are v1 defaults — meant to be tuned once real scoring/outreach data comes in, not treated as final.
- Whether "adjacent regulated" industries (Fintech, Insurance) are included in Rule-1 at all, or excluded entirely for v1 — currently included at reduced priority via Rule B's Medium-fit tier.
