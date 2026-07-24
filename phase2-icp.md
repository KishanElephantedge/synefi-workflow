# Synefi — Phase 2: Ideal Customer Profile (ICP) Definition

## Objective

Define the structured, evidence-backed specification of what a good customer looks like for Synefi, so
that every later phase (Company Discovery, Qualification, Scoring, Decision-Maker Targeting) evaluates
companies against a single, consistent, defensible profile — instead of each phase independently guessing
at fit criteria, which is how the original build drifted (e.g. an employee-count filter set arbitrarily,
an industry-fit ranking inherited from marketing copy rather than evidence).

## Business Question

> **What defines a company Synefi should pursue, and how confident is each part of that definition?**

This phase does not discover companies and does not score signals — it produces the **ICP Agent's
specification**, which Company Discovery and Qualification (later phases) consume as their input
contract. Getting this specification wrong propagates an error into every phase downstream of it, which
is why each criterion below is evidenced and confidence-rated individually rather than asserted as a flat
list of filters.

---

## Criterion 1 — Employee Count

**Why this criterion exists**: company size is the single strongest available proxy for whether a
prospect has outgrown the agility (and small deal size) of an SMB engagement, without yet entering
Enterprise-scale procurement bureaucracy that a smaller outside vendor like Synefi cannot efficiently
service.

**Evidence**:
- SMB is generally defined as under 100 employees and under $50M revenue, with deal cycles closing in
  1–3 months — fast, but deal sizes too small to prioritize.
- Mid-market (100–999 employees) deals typically close in 2–5 months at $20K–$100K/year — the band
  identified as the effective sweet spot for agency-model service providers generally.
- Enterprise (1,000+ employees, $1B+ revenue) sales cycles now average 6.5 months and are lengthening,
  driven by larger buying committees and tighter budget scrutiny — a poor fit for a smaller external
  vendor's sales capacity.
- Source: [SMB vs Enterprise: Market Segments, Size, Demographics & Sales Strategy for 2026](https://martal.ca/smb-vs-enterprise-lb/), [B2B Sales Cycle Length Benchmarks](https://optif.ai/learn/questions/sales-cycle-length-benchmark/)

**Interpretation**: the full evidenced mid-market band is 100–999 employees. The system's current live
filter (100–500) is a valid **subset** of that band, not a contradiction of it — it trades some reachable
companies (501–999) for a tighter, faster-cycle segment within the validated range.

**Decision Logic**: employee count functions as a **hard qualification gate** — a company outside the
selected band is not scored, it is excluded from discovery entirely (this matches the existing
`crustdata_companydb_search` numeric filter behavior).

**Final Decision**: retain **100–500 employees** as the qualifying band.

**Confidence**: High — directly evidenced, and consistent with the system's current implementation.

**Notes / Limitations**: widening to the full evidenced 100–999 band is a supported option for future
testing, not adopted in this pass — no explicit decision was made to expand scope beyond what is
currently running.

---

## Criterion 2 — Revenue

**Why this criterion exists**: employee count alone can miss companies that are lean-staffed but
well-funded, or conversely large-staffed but resource-constrained. Revenue is a materially different
axis of qualification, and one the system currently does not check at all.

**Evidence**: smaller healthcare businesses generating **$5M–$25M in annual revenue** — medical practices,
specialty clinics, home health agencies — are actively evaluating consulting partners specifically because
they need a partner who understands operations at their scale, distinct from enterprise-focused firms.
Source: [Pharma AI Consulting Firms: 2026 Evaluation Guide](https://intuitionlabs.ai/articles/pharma-ai-consulting-firms-evaluation-guide)

**Interpretation**: this identifies a real, currently-unqualified segment — companies that may fall inside
or even below the employee-count band above, but are a genuine buyer profile on revenue grounds alone.
This is evidence for a **new, independent criterion**, not a restatement of the employee-count finding.

**Decision Logic**: revenue functions as a **secondary qualifying signal**, evaluated only when revenue
data is available from the discovery provider (not all providers return it reliably) — a missing revenue
value does not disqualify a company, since employee count already serves as the primary size gate.

**Final Decision**: adopt **$5M–$50M annual revenue** as a secondary qualifying band, layered on top of the
employee-count gate rather than replacing it.

**Confidence**: Medium — the evidence is a single sourced finding (healthcare-specific), not
cross-validated against Pharma or Medical Devices independently.

**Notes / Limitations**: not yet implemented in code — `crustdata_companydb_search` is not currently
called with a revenue filter, and revenue is not currently stored on the `Company` model. This is a
documented specification gap, not a silent decision to skip it.

---

## Criterion 3 — Industry

**Why this criterion exists**: industry determines which sub-vertical signals and compliance-pain framing
apply, and directly reflects Synefi's stated specialization ("Safe Agentic AI for Regulated Industries").

**Evidence**: established in Phase 1 (Market Intelligence) — Healthcare and Pharma/Biotech are the
highest-priority segments (still mid-adoption-curve, actively seeking outside help); Financial
Services/Insurance is a real but lower-priority secondary market (79% already adopted, higher competition,
likely entrenched vendors). See `phase1-market-intelligence.md` for the full sourced findings.

**Interpretation**: no new interpretation required in this phase — Phase 1's findings are consumed
directly.

**Decision Logic**: industry functions as a **weighted scoring factor**, not a hard gate — a company
outside Healthcare/Pharma/Medical Devices is not excluded outright, but is scored lower (this matches the
existing `icp_fit` sub-industry-fit component design in `phase2-scoring.md`).

**Final Decision**: Healthcare, Pharma/Biotech, Medical Devices = primary (high weight); Financial
Services/Insurance = secondary (reduced weight, not excluded).

**Confidence**: High for Healthcare/Pharma (independently sourced in Phase 1); Medium for Medical Devices
(no independent source found, carried forward on Healthcare's evidence and existing positioning).

---

## Criterion 4 — Geography

**Why this criterion exists**: geography determines the addressable market scope for company discovery
and directly affects which data-provider filters are used.

**Evidence**: Phase 1 research surfaced a materially significant finding — the EU AI Act's Annex III
high-risk compliance deadline (2026-08-02) creates a large, dated, high-urgency demand signal for
pharma/healthcare AI vendors serving the EU market, regardless of company headquarters location. Full
detail is intentionally **not** repeated here — that finding is a **buying trigger** (a time-bound event
that indicates *when* to act on an already-qualified account), not an ICP characteristic (which defines
*who* to consider at all). It is documented in full under the Buying Signal/Trigger phase once that phase
is built, and cross-referenced from here.

**Interpretation**: the ICP's geography criterion is a scope decision, independent of the trigger-event
finding above — the finding informs a *future* expansion decision, not this phase's current scope.

**Decision Logic**: geography functions as a **hard qualification gate** — Synefi's current directive
scopes the business to the US market only; discovery is not run against non-US companies regardless of
any other criterion match.

**Final Decision**: **United States only** (`hq_country = USA`), per explicit business directive.

**Confidence**: this is a business-scope decision, not a research finding — certainty is high because it
is directive-based, not because the evidence favors US over EU. The EU AI Act finding remains a
documented, unresolved expansion candidate, tracked in the Buying Signal/Trigger phase, not silently
discarded.

**Notes / Limitations**: revisit this gate if/when Synefi's business scope changes; no code change is
required now since the current implementation already scopes to `hq_country = USA`.

---

## Criterion 5 — Growth Stage

**Why this criterion exists**: growth-stage signals (recent funding, headcount growth) function as a proxy
for whether a company currently has discretionary budget available for an uncertain, non-core initiative
like an external AI build.

**Evidence**: not independently re-researched in this phase. The existing `financial_growth` scoring
component design (`phase2-scoring.md`, Component C — funding event or >15% YoY headcount growth) was
carried forward without new evidence gathering, since no research this session surfaced information
contradicting it.

**Interpretation**: absence of new evidence is not evidence of correctness — this criterion's confidence
is rated accordingly.

**Decision Logic**: growth stage functions as a **secondary weighted scoring factor**, evaluated only when
a company has already passed the Employee Count and Geography hard gates.

**Final Decision**: retain the existing funding-event / headcount-growth proxy as designed in
`phase2-scoring.md`, unchanged.

**Confidence**: Low-Medium — carried forward from a prior, un-re-verified design, not newly evidenced in
this pass.

**Notes / Limitations**: flagged as an open item for a dedicated research pass, same status as Medical
Devices in Phase 1.

---

## Combined Decision Logic — how the ICP Agent evaluates a company

A company is not evaluated against these five criteria independently — the ICP Agent applies them as a
two-stage filter:

**Stage 1 — Hard gates (must pass both to proceed at all):**
1. Geography = United States
2. Employee count within 100–500

A company failing either gate is excluded from discovery entirely and is not scored on any other
criterion.

**Stage 2 — Weighted fit scoring (applied only to companies that passed Stage 1):**
3. Industry match (primary vs. secondary weighting)
4. Revenue band match, where data is available (secondary signal, not required)
5. Growth-stage signal presence (secondary signal, not required)

This two-stage structure is why Geography and Employee Count are documented above as gates while
Industry, Revenue, and Growth Stage are documented as scored factors — the distinction is load-bearing for
how the next phase (Company Qualification/Scoring) is expected to consume this profile: gates prune the
candidate list before any paid enrichment call is made; weighted factors determine priority ranking
*within* the surviving candidates.

---

## Output

This phase produces a structured ICP profile, consumed directly by Company Discovery and Company
Qualification:

```
{
  "hard_gates": {
    "geography": "USA",
    "employee_count_range": { "min": 100, "max": 500 }
  },
  "weighted_criteria": {
    "industry": {
      "primary": ["Healthcare", "Pharma/Biotech", "Medical Devices"],
      "secondary": ["Financial Services", "Insurance"]
    },
    "revenue_range": { "min_usd": 5000000, "max_usd": 50000000, "required": false },
    "growth_stage_signals": { "funding_event_window_days": 180, "headcount_growth_yoy_pct": 15, "required": false }
  },
  "confidence_by_criterion": {
    "employee_count": "high",
    "revenue": "medium",
    "industry": "high (healthcare/pharma) / medium (medical devices)",
    "geography": "high (directive-based)",
    "growth_stage": "low-medium"
  }
}
```

Any criterion above marked `"required": false` and not yet implemented in code (Revenue) is an explicit
specification gap for the next phase to either implement or formally defer — not an implicit omission.

---

## Cross-references
- Industry and market-priority findings: `phase1-market-intelligence.md`
- EU AI Act buying-trigger detail: to be documented under the Buying Signal/Trigger phase (not yet built)
- Existing `icp_fit` and `financial_growth` scoring components: `phase2-scoring.md` (pre-existing design,
  referenced not restated)
