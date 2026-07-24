# Synefi — Phase 1: Market Intelligence

Status: **new phase — did not exist before this rework.** Position in the redesigned 12-phase ABM
framework (see `/Users/kishanbm/Downloads/note.txt` for the generic, company-agnostic version of this
framework): this is Phase 1, and it runs **before** ICP definition (Phase 2) — you have to know which
markets are worth targeting before you define what a good customer looks like inside one.

Why this phase is being added now: the existing pipeline went straight from "Synefi's own website says
regulated industries" to building signal discovery scoped to pharma/healthcare/medtech, without anyone
actually researching whether that's the right market to prioritize, or how it compares to adjacent
options our own scoring doc (`phase2-scoring.md`) already half-includes (Fintech, Insurance) without ever
justifying why. This doc is that missing justification, done properly, with real sources.

---

## What question this phase answers

> **Which markets should we focus on — and why, with evidence, not assumption?**

Not "what does the client's website say," and not "what industry did we happen to start with" — an
actual evidence-based ranking, so every later phase (ICP, scoring, decision-maker targeting) inherits a
market choice that was checked, not guessed.

---

## Metrics used, and why each one was chosen

| Metric | Why it matters for this decision |
|---|---|
| **Total AI spend ($ / industry)** | Raw budget size — tells you how much money exists in the sector overall, i.e. the ceiling on what's available to be won |
| **Adoption rate (% of companies already using AI)** | Tells you how *mature* the sector already is. A high number sounds good, but it also means most of the easy buyers are already served by someone — less an open opportunity, more a saturated one |
| **Adoption growth rate / CAGR** | Tells you how fast a sector is *moving through* its adoption curve right now — this is the real proxy for "how many companies are currently in the window where they still need outside help," which matters more for us than raw budget size |
| **Regulatory/compliance pressure** | Directly relevant to Synefi's specific pitch ("Safe Agentic AI for Regulated Industries") — a sector under real compliance pressure (EU AI Act, NIST AI RMF, DORA) has a *specific*, provable pain point our positioning answers, not a generic "AI is trendy" pitch |

The reasoning for picking growth-rate and regulatory-pressure over pure spend size is explained in the
findings table below — it's the difference between "which market has the most money" and "which market
still needs an outside partner like Synefi right now."

---

## Findings, by industry

| Industry | AI spend / market size | Adoption maturity | Growth rate | Regulatory pressure | Verdict |
|---|---|---|---|---|---|
| Healthcare | $45B in 2026, projected $100–150B | 38% → 67% adoption in 2 years (+29 points) — **fastest acceleration of any sector** | 36.8% CAGR (adoption) | High (HIPAA, FDA AI/ML guidance) | **Primary** — still mid-transition, a large share of companies are actively in the "need outside help" window right now |
| Pharma/Biotech (agentic specifically) | AI-in-pharma market ~$6.16B in 2026 → $34.99B by 2031 | Smaller base, but the fastest-*growing* niche | ~41.5% CAGR (AI-in-pharma); 34–44% CAGR for agentic AI in healthcare specifically | High (FDA, clinical trial regulation) | **Primary** — smaller in absolute dollars, but matches Synefi's specific "agentic" positioning better than generic healthcare AI does |
| Financial Services (incl. Insurance) | $68B — the single largest sector by spend | **79% adoption already** | Slower than healthcare (already past its steepest acceleration) | Very high (EU AI Act, DORA since Jan 2025, model-risk management) | **Secondary** — real budget and real regulatory pain, but most of the easy buyers are already served; higher competition, likely entrenched vendors |
| Medical Devices | Not separately broken out in the sources found — bundled with Healthcare in most industry reports | — | — | High (FDA 510(k)/PMA) | Kept in scope (matches Synefi's existing positioning), but not independently evidenced yet — flagged as an open item below |

**The one finding that should actually change how we think about this, not just confirm what we assumed**:
our current scoring (`phase2-scoring.md`) ranks Fintech/Insurance as "Medium fit" and Healthcare/Pharma as
"High fit" — that was inherited from Synefi's own website copy, never independently checked. The research
*does* back up that ranking, but for a different reason than assumed: it's not that healthcare has more
money — **Financial Services actually has more ($68B vs $45B)**. It's that healthcare/pharma are still
mid-transition and actively need outside help, while finance is already 79% adopted and likely has
established vendor relationships. "Still in the window" is the real justification — "biggest budget" was
the wrong reason we'd have given before this research, even though it happened to point the same
direction.

---

## Phase output (per the framework's expected deliverable)

**Market Segments** (priority order):
1. Healthcare
2. Pharma/Biotech
3. Medical Devices (in scope, evidence weaker — see open items)
4. Financial Services / Insurance (secondary/expansion market, not dropped)

**Industry Profiles**: each segment above is tagged with its real growth rate, adoption maturity, and
"still needs outside help" status, per the findings table.

**Market Priorities**: Healthcare and Pharma/Biotech are primary — matching Synefi's existing positioning,
but now for an evidenced reason (highest-opportunity adoption window) rather than an assumed one.
Financial Services/Insurance is kept as a real secondary market — genuine budget and regulatory pressure
exist there, but it's a harder, more competitive sell right now, not a "not worth pursuing" market.

---

## Open items (not resolved yet, flagged rather than glossed over)
- Medical Devices doesn't have independently sourced growth/adoption data yet in this pass — it was kept
  in scope on the strength of Healthcare's numbers and Synefi's existing positioning, not on its own
  evidence. Worth a dedicated search pass if/when Medical Devices becomes a meaningful share of discovered
  companies.
- Geography was not investigated in this pass (Phase 1 discovery currently hard-codes `hq_country = USA`)
  — worth revisiting if international expansion becomes relevant.
- This phase should be revisited periodically (industry AI-adoption curves move fast — the whole reason
  healthcare ranked above finance here is a *rate of change*, which will itself change over the coming
  quarters), not treated as a permanent, one-time finding.

---

## Sources
- [Enterprise AI Spending by Industry 2026: $407B Total, Sector-by-Sector Breakdown](https://valueaddvc.com/blog/enterprise-ai-spending-by-industry-whos-deploying-the-most-in-2026)
- [AI adoption in healthcare outpaces the overall US economy](https://www.emarketer.com/content/ai-spending-healthcare-outpaces-overall-us-economy-)
- [AI Adoption in Pharma & Biotech: 2026 Industry Benchmarks](https://intuitionlabs.ai/articles/ai-adoption-pharma-biotech-benchmarks)
- [Agentic AI in Healthcare Market Size, Share | Forecast 2034](https://www.fortunebusinessinsights.com/agentic-ai-in-healthcare-market-115702)
- [AI in Pharmaceutical Market Analysis | Industry Growth, Size & Forecast Report 2031](https://www.mordorintelligence.com/industry-reports/artificial-intelligence-in-pharmaceutical-market)
- [Top 7 industries with stringent AI compliance needs in 2026](https://www.glean.com/perspectives/top-7-industries-with-stringent-ai-compliance-needs-in-2026)

---

## Status note
This is the first phase finalized under the redesigned 12-phase ABM framework (see
`/Users/kishanbm/Downloads/note.txt`), replacing the old `blueprint.md` phase numbering. Next: Phase 2 —
Ideal Customer Profile (ICP) Definition, which builds directly on the Market Priorities established here.
