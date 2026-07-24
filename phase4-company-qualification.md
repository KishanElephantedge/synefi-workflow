# Synefi — Phase 4: Company Qualification

## Objective

Determine which companies from Phase 3's raw candidate list are structurally worth pursuing at all,
independent of whether anything time-sensitive is currently happening at them. Produces a qualified
candidate list with a Fit Score, for the (future, not yet documented) Buying Signal Intelligence phase to
then evaluate for timing.

## Business Question

> **Of the companies Discovery found, which ones should Synefi consider selling to at all — regardless of
> whether something is happening at them right now?**

This phase deliberately does not ask "is now the right time." That is a different question, answered by a
different phase, using different kinds of data — and this project's own research this session confirms
that distinction is not a stylistic preference, it is the standard, load-bearing design decision in
account-based scoring generally.

---

## Architecture Review Finding: Fit vs. Intent Must Be Scored Separately

**Why this matters**: Phase 3 (Company Discovery) closed with an open question — the current
implementation checks a hiring-signal job posting *inside* the Discovery step, and that check needed a
formal home. This phase resolves it.

**Evidence**: external account-scoring research independently confirms the same separation this project's
adopted framework (`/Users/kishanbm/Downloads/note.txt`) already implied: **"the single most important
design decision in any scoring model is to keep fit and intent as separate numbers, with fit answering a
structural question — should we be selling to this account at all — and intent answering a timing
question — is now the moment."** Source: [The Definitive Guide to Account Scoring](https://www.captivateiq.com/blog/account-scoring)

**Interpretation**: a hiring-signal job posting is not a Fit characteristic — it is a dated, decaying
event (this project's own scoring design already applies a 90-day recency decay to it, which is itself
evidence it was always behaving like a timing signal, not a structural one). It belongs to Intent /
Buying Signal Intelligence, a phase not yet documented, not to Qualification.

**Decision Logic**: Qualification (this phase) evaluates only durable company characteristics — traits
that remain roughly true regardless of what happened this week. Anything dated, event-based, or subject to
recency decay is explicitly out of scope here and deferred to the future Buying Signal Intelligence phase.

**Final Decision**: hiring-signal detection (`find_job_posting_signals` in the current codebase) is
formally assigned to the future Buying Signal Intelligence phase, not to Qualification. This phase does not
re-implement or re-check it.

**Confidence**: High — now backed by both the adopted framework and independent external confirmation,
not just an internal architectural comparison.

---

## Qualification Agent Workflow

```
Receive Candidate List (from Phase 3)
        │
        ▼
For each candidate, evaluate independently:
        │
        ├──► Business Fit Check       (reuse Phase 2 ICP weighted criteria)
        │
        ├──► Operational Fit Check    (technographic lookup)
        │
        ├──► Strategic Fit Check      (durable growth trend, not a dated event)
        │
        └──► Commercial Fit Check     (budget/cycle proxy)
        │
        ▼
Composite Fit Calculator
(combines the four independent scores above
 using the fixed weighting defined below)
        │
        ▼
Fit Score ≥ qualification threshold?
        │
   ┌────┴────┐
  YES        NO
   │          │
   ▼          ▼
Qualified   Drop
Candidate   (Excluded,
  List      not scored further)
```

Each of the four checks runs independently and does not depend on the outcome of the others — this
matters because a candidate should never be skipped on Operational Fit just because Business Fit already
scored low, for example. The Composite Fit Calculator is the single point where all four are combined; no
individual check performs its own pass/fail gating.

### Dependency on Phase 3

This phase assumes Phase 3 (Company Discovery) has already normalized provider-specific fields — company
name, industry, location, employee count, domain — into the common internal schema defined in that
phase's Normalization topic. Qualification does not re-normalize or re-interpret raw provider fields; it
operates only on already-normalized candidate records.

---

## Topic 1 — Business Fit

**Why this criterion exists**: confirms the candidate still matches the ICP's weighted criteria at the
point of qualification, not just at discovery time (a candidate could have been discovered before an
industry-classification correction, for example).

**Evidence**: fully established in Phase 2 (`phase2-icp.md`) — industry weighting (Healthcare/Pharma
primary, Financial Services/Insurance secondary), revenue band ($5M–$50M, where available), employee count
(100–500, already enforced as a Discovery hard gate).

**Interpretation**: no new research needed — this criterion is a direct reuse, not a re-derivation. This
phase **validates ICP alignment; it does not rediscover or redefine the ICP.** Phase 2 owns what the
criteria are and why; this phase only checks whether a given candidate still satisfies them.

**Decision Logic**: Business Fit score is computed directly from Phase 2's already-defined weighted
criteria; it is not re-researched or re-weighted in this phase.

**Final Decision**: reuse Phase 2's ICP weighting as Business Fit's scoring input, unchanged.

**Confidence**: High — inherited directly from an already-evidenced phase.

---

## Topic 2 — Operational Fit

**Why this criterion exists**: a company's existing technology maturity indicates whether it can actually
absorb an external AI build — a company already running modern infrastructure integrates new AI work
faster than one running on legacy systems with no technical runway.

**Evidence**: a company running legacy infrastructure that is also actively researching modernization is
described in industry research as "the highest-priority account you can find" for exactly this kind of
engagement. A direct check of Deepline's tool catalog confirms **BuiltWith technographic lookups
(`builtwith_domain_lookup`, `builtwith_trends`) are already available**, at no new vendor cost, and have
never been used anywhere in this pipeline. Source: [How to Accelerate B2B Deals with Technographic Intent Triggers](https://hginsights.com/blog/how-to-accelerate-deals-with-technographic-intent-triggers/)

**Interpretation**: "actively researching modernization" (the second half of that finding) is itself a
dated, event-like signal — it belongs to Buying Signal Intelligence, per the Fit/Intent separation above.
What belongs to Qualification is the durable half only: **what technology this company is already running
today** — a static characteristic, not an event.

**Decision Logic**: Operational Fit is scored from a technographic snapshot (current tech stack composition)
via `builtwith_domain_lookup`, evaluated for legacy-vs-modern signal (e.g. presence of modern cloud/AI
infrastructure vs. dated on-premise/legacy platform indicators). This is a point-in-time characteristic
check, not a signal-freshness check — no recency decay is applied, unlike Buying Signal Intelligence's
future hiring-signal handling.

**Final Decision**: adopt `builtwith_domain_lookup` as the Operational Fit data source. Legacy-vs-modern
classification logic is not fully specified in this pass — flagged as an implementation task, not
resolved here.

*Illustrative examples only, not implementation rules* — the kind of indicator this dimension is expected
to look for:
- **Modern indicators**: cloud infrastructure (AWS/GCP/Azure), modern data-stack tooling (Snowflake,
  dbt), API-first architecture, containerization (Docker/Kubernetes) — suggest a company can integrate new
  AI work with less friction.
- **Legacy indicators**: on-premise ERP platforms (older SAP/Oracle installations), on-premise email/
  collaboration stacks, absence of any detectable modern cloud footprint — suggest more integration
  friction, but not necessarily disqualification; per Topic 1 of `phase2-scoring.md`'s original design,
  a legacy footprint paired with an active modernization signal was intended to be a *positive* indicator,
  not a negative one (that pairing itself belongs to Buying Signal Intelligence, per this phase's Fit/
  Intent separation).

These examples exist to illustrate the kind of signal this dimension evaluates; the actual scoring rule
(how a specific technographic profile maps to a numeric Operational Fit score) is intentionally left as an
implementation-time decision, not fixed here.

**Confidence**: Medium — the data source is confirmed available and free to use, but the actual
legacy-vs-modern scoring rule has not yet been designed or tested against real company data.

**Notes / Limitations**: not yet implemented in code. Graceful degradation is required — a company with no
BuiltWith data available (small companies often have thin technographic footprints) should not be
penalized to zero; it should be treated as "unscored" on this dimension, not "failed," so Operational Fit
absence doesn't unfairly disqualify an otherwise-good candidate.

---

## Topic 3 — Strategic Fit

**Why this criterion exists**: distinguishes a company that is generally in a growth/transformation
posture from one that is static — relevant to whether an AI initiative is likely to have real internal
momentum behind it, independent of any single dated trigger.

**Evidence**: this project's own existing (currently disabled) `financial_growth` scoring component
conflates two genuinely different things: a **funding event** (dated, time-sensitive — an Intent signal
per the Fit/Intent separation above) and **>15% YoY headcount growth** (a durable trend, a true Strategic
Fit characteristic). No new external research was needed to identify this — it follows directly from
applying this phase's own Fit/Intent rule to the existing design.

**Interpretation**: the existing component needs to be split, not simply re-enabled as-is. Headcount
growth trend belongs here (Strategic Fit); funding events belong to the future Buying Signal Intelligence
phase.

**Decision Logic**: Strategic Fit is scored from durable trend data only — sustained employee headcount
growth over a trailing period — with any single dated funding event excluded from this phase's scoring
entirely.

**Final Decision**: adopt headcount-growth trend (the durable half of the existing `financial_growth`
design) as Strategic Fit's input; formally exclude funding-event detection from this phase, reassigning it
to the future Buying Signal Intelligence phase alongside hiring-signal detection.

**Confidence**: Medium — the split is architecturally sound and directly evidenced by this phase's own
Fit/Intent rule, but headcount-growth-trend scoring has not been re-verified against real data in this
pass (same un-re-verified status this component already carried in `phase2-scoring.md`).

---

## Topic 4 — Commercial Fit

**Why this criterion exists**: a company can match every other fit criterion and still be a poor
prospect if it can't plausibly afford the engagement, or if its likely sales cycle doesn't match what
Synefi can service.

**Evidence**: Phase 2 already established the sales-cycle/deal-size profile for the ICP's employee-count
band — mid-market companies (100–999 employees) close in 2–5 months at $20K–$100K/year deal sizes, a
profile Synefi's ICP (100–500 employees) sits within. Revenue band ($5M–$50M, Phase 2 Criterion 2) is the
direct budget-plausibility proxy already defined.

**Interpretation**: no new research is required here — Commercial Fit is a direct application of Phase 2's
already-evidenced revenue and size-band findings, viewed through a budget/cycle lens rather than a pure
qualification-gate lens.

**Decision Logic**: Commercial Fit is scored from revenue-band match (where available) and employee-count
position within the ICP band, as a proxy for both purchasing capability and expected sales-cycle length.

**Final Decision**: reuse Phase 2's revenue-band and employee-count findings as Commercial Fit's scoring
input; no independent new criterion introduced.

**Confidence**: Medium — the underlying findings are High confidence, but their reuse specifically as a
*budget/cycle* proxy (versus their original use as ICP hard/secondary gates) has not been independently
tested.

**Fallback behavior when revenue data is unavailable**: revenue coverage is not guaranteed across all
discovery candidates (Phase 2 already documents revenue as `"required": false`). When revenue is missing,
Commercial Fit falls back to employee-count position within the ICP band as the budget/cycle proxy instead.
If employee count is also unavailable (should not occur given it is a Discovery hard gate, but handled
defensively), this dimension is left **unscored** rather than scored as zero or used to fail the
candidate — consistent with the graceful-degradation principle applied to Operational Fit in Topic 2.

---

## Composite Fit Score and Qualification Threshold

**Decision Logic**: the four dimensions above are combined into a single composite Fit Score, weighted by
how directly evidenced each is: Business Fit (max 40), Operational Fit (max 20), Strategic Fit (max 20),
Commercial Fit (max 20) — a 100-point scale.

**Why Business Fit is weighted higher than the other three**: Business Fit is the only dimension that is
already partially enforced as a hard gate at Discovery time (employee count) and fully evidenced across
two independent phases (Phase 1's market research and Phase 2's ICP definition) — it carries the least
uncertainty of the four. Operational, Strategic, and Commercial Fit are each Medium-confidence, single
-source-evidenced dimensions with no independent gating already applied to them, so they are weighted
equally (20% each) rather than ranked against one another — there is no current evidence that any one of
the three durable-characteristic dimensions predicts fit better than the others.

A candidate below a defined qualification threshold is dropped and does not proceed; a candidate at or
above it becomes a Qualified Candidate, ready for the (future) Buying Signal Intelligence phase to evaluate
for timing.

**Final Decision**: adopt a 100-point composite scale as above. The qualification threshold itself (e.g.
60/100) is a **configurable operational parameter, not an architectural constant** — it is expected to be
set and recalibrated using real scored outcomes over time (the same posture already taken for tier
thresholds in the legacy `phase2-scoring.md`), not hardcoded into the qualification logic.

**Confidence**: Low-Medium on the threshold specifically (unvalidated), High on the four-dimension
structure itself (directly evidenced above).

**Notes / Limitations**: this composite score is a **redesign of the legacy `icp_fit` component** in
`phase2-scoring.md` — that document's Component B (Sub-industry Fit + Company Size, max 40) is now
subsumed by this phase's Business Fit dimension, and its Component C (`financial_growth`) is split between
this phase's Strategic Fit (headcount trend) and the future Buying Signal Intelligence phase (funding
events), per Topic 3 above. `phase2-scoring.md` remains as a historical record of the original design: it
is not deleted, but this document supersedes its Fit-related components going forward.

---

## Failure Handling

Qualification distinguishes between three different data-quality problems, since each requires different
handling:

- **Missing data** (a field is absent — e.g. no BuiltWith result for a small company, no revenue figure
  returned by the discovery source): the affected dimension is scored as "unscored" and excluded from the
  composite calculation rather than defaulted to zero, consistent with the graceful-degradation approach
  in Topics 2 and 4. This is the expected, common case and does not indicate a system problem.
- **Invalid data** (a field is present but malformed or out of any plausible range — e.g. a negative
  employee count, a revenue value clearly outside any real business's scale): the field is treated as if
  it were missing for scoring purposes, but is also logged distinctly from a true missing-data case, since
  invalid data suggests a Discovery- or Normalization-stage defect worth investigating, whereas missing
  data is often just genuine data-source coverage gaps.
- **Conflicting data** (the same candidate has been discovered more than once — e.g. via Discovery's
  duplicate-detection fallback path — with different values for the same field, such as two different
  employee-count figures): resolved by preferring the most recently retrieved value, with the conflict
  itself logged for review rather than silently overwritten, since a recurring conflict on a specific
  field may indicate a normalization rule that needs correction.

A candidate missing data across *all four* dimensions indicates a Discovery- or Normalization-stage data
problem, not a genuine Qualification failure, and should be flagged for review rather than silently
dropped.

---

## Output

```
{
  "qualified_candidates": [
    {
      "name": "...",
      "domain": "...",
      "fit_score": {
        "business_fit": 0,
        "operational_fit": 0,
        "strategic_fit": 0,
        "commercial_fit": 0,
        "total": 0
      },
      "unscored_dimensions": [],
      "qualification_status": "qualified | dropped | flagged_for_review",
      "qualification_reason": "optional, human-readable explanation of why this status was reached — e.g. 'Business Fit strong, Operational Fit unscored (no technographic data), passed threshold at 68/100' — for downstream explainability and future UI, not required for the qualification decision itself"
    }
  ],
  "qualification_metadata": {
    "candidates_received": 0,
    "candidates_qualified": 0,
    "candidates_dropped": 0,
    "candidates_flagged_for_review": 0,
    "threshold_used": 0
  }
}
```

The next phase (Buying Signal Intelligence, not yet documented) receives only the `qualified_candidates`
list, and is responsible for evaluating timing signals — hiring postings, funding events, leadership
changes, and the other dated triggers explicitly excluded from this phase.

---

## Cross-references
- **Consumed from**: Phase 3 (`phase3-company-discovery.md`) — raw candidate list; Phase 2
  (`phase2-icp.md`) — ICP weighting reused directly for Business Fit
- **Produced for**: Buying Signal Intelligence phase (not yet documented) — qualified candidate list
- **Supersedes**: `phase2-scoring.md` Components B (`icp_fit`) and C (`financial_growth`, split) — that
  document is retained as historical record, not deleted
- Existing implementation referenced: `app/phases/scoring.py` (`_score_icp_fit`,
  `_score_financial_growth`), `app/phases/signal_discovery.py` (`find_job_posting_signals`, reassigned per
  the Architecture Review Finding above)
