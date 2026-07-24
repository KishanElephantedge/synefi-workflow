# Synefi — Phase 3: Company Discovery

## Objective

Identify the set of candidate companies that satisfy Phase 2's ICP hard gates, producing a raw candidate
list for the next phase to qualify. This phase makes no judgment about signal strength, buying intent, or
fit quality — those decisions belong to later phases.

## Business Question

> **Given the ICP profile, where do we find companies that match it, and which source(s) should the
> Discovery Agent query to do so reliably and at reasonable cost?**

A core principle carried over from the generic ABM framework applies directly here: **Discovery is not
Qualification.** The output of this phase is only a candidate list — a company appearing in that list is
not yet a "good" or "bad" prospect, it is simply a company that matched the ICP's structural criteria
(geography, employee count). Whether it shows real buying intent is a separate, later question.

---

## Discovery Agent Workflow

The Discovery Agent executes as a single, repeatable loop, not an ad hoc script:

```
Receive ICP (from Phase 2)
        │
        ▼
Select Provider
        │
        ▼
Build Query (map ICP hard gates → provider filter fields)
        │
        ▼
Execute Query (fetch one page of candidates)
        │
        ▼
Normalize Results (common schema, see Normalization below)
        │
        ▼
Remove Duplicates (see Duplicate Detection below)
        │
        ▼
Target reached, or no next page available?
        │
   ┌────┴────┐
  YES        NO
   │          │
   ▼          ▼
Return    Fetch Next Page
Candidate      │
  List         └──────► (back to Execute Query)
```

Every topic below is a decision made at one specific step of this loop — the workflow is what ties them
into a single coherent agent rather than a list of independent settings.

---

## Topic 1 — Discovery Source Selection

**Why this decision exists**: the system has only ever queried one provider (Crustdata, via Deepline) for
company discovery. This was never an evaluated choice — it was the first tool available and nothing since
has re-examined whether it's the right one, or the only one needed.

**Evidence**:
- Definitive Healthcare is the dominant healthcare-specific commercial intelligence provider: 310,000+
  healthcare organizations, layered with claims-based referral patterns, procedure volumes, facility
  financials, and technology install data. It is explicitly positioned as **"built for intelligence, not
  outbound"** — i.e. strong for understanding a healthcare account, not for executing contact discovery or
  outreach. Source: [Healthcare Data Providers: How to Evaluate Coverage, Compliance, and Freshness](https://forage.ai/blog/healthcare-data-providers/), [Definitive Healthcare Alternatives 2026](https://www.glnkco.com/blogs/definitive-healthcare-alternatives-2026-pharma-healthtech)
- A direct check of Deepline's live tool catalog (`deepline tools list --json`) confirms **Definitive
  Healthcare is not available through Deepline** — adopting it would require a new, independent vendor
  relationship and integration, not a configuration change.
- That same check confirms **Apollo, People Data Labs, Aviato, and BuiltWith are already available through
  Deepline** at no additional cost, and none of them have ever been used for company discovery in this
  system — only Crustdata has.
- General market comparison: for SMB/mid-market-focused firmographic accuracy, Cleanlist, Apollo, and
  UpLead rank highest; UpLead specifically reports 155M+ contacts and 16M+ companies with the deepest
  coverage in North America, leaning toward mid-market/SMB accounts — a close match to Phase 2's ICP band.
  Source: [Best B2B Data Providers 2026](https://www.cleanlist.ai/blog/2026-05-22-best-b2b-data-providers-2026), [Best B2B Company Data Providers in 2026](https://prospeo.io/s/b2b-company-data)

**Interpretation**: there is no evidenced case for switching away from Crustdata as the primary discovery
source — it is a general-purpose firmographic database with a numeric employee-count filter that already
satisfies Phase 2's hard gates directly. The evidenced opportunity is **cross-validation, not
replacement**: querying a second already-available provider (Apollo or People Data Labs) for the same ICP
band and comparing candidate overlap would surface whether Crustdata's coverage has material gaps, at zero
new vendor cost. Definitive Healthcare remains a documented option for a future, separate evaluation if
Crustdata's healthcare-specific coverage proves insufficient — not adopted now, since it requires new
procurement.

**Decision Logic**: source selection is a **single-provider-with-a-documented-fallback-option** design,
not a multi-source aggregation, to keep Discovery's cost and complexity proportional to what evidence
currently justifies.

**Final Decision**: retain **Crustdata (via Deepline)** as the sole discovery source for this phase. Adopt
no new source at this time.

**Confidence**: Medium — Crustdata has not failed or shown a coverage gap in practice, but it has also
never been benchmarked against an alternative, so this is a decision of "no evidenced reason to switch,"
not "proven to be the best available option."

**Notes / Limitations**: a low-cost, zero-new-vendor validation step — querying Apollo or People Data Labs
for the same ICP band and diffing candidate lists — is a concrete, specific, and inexpensive way to raise
this confidence rating, and is flagged here as a candidate follow-up rather than performed in this pass.

---

## Topic 2 — Query Construction from the ICP Hard Gates

**Why this decision exists**: Phase 2 defines *what* qualifies a company; this phase must translate that
into an actual, correctly-scoped provider query.

**Evidence**: Crustdata's `companydb_search` tool accepts `hq_country` (exact match) and
`employee_metrics.latest_count` (numeric `>=`/`<=` operators, confirmed via `deepline tools describe`) —
both hard gates from Phase 2 map directly and precisely onto real, available filter fields, with no
approximation required.

**Interpretation**: no gap exists between the ICP specification and what the discovery source can
actually filter on for these two criteria. The same is not true for Revenue (Phase 2, Criterion 2) — no
revenue filter field has been confirmed on this provider, which is why Revenue was documented in Phase 2
as `"required": false` and unimplemented, not silently dropped.

**Decision Logic**: query construction is a **direct field mapping** from the ICP's hard-gate criteria to
provider filter parameters — `hq_country = "USA"`, `employee_metrics.latest_count >= 100 AND <= 500` —
with no fuzzy or approximate matching applied at this stage.

**Final Decision**: retain the current query construction (already implemented in
`discover_company_page`).

**Confidence**: High — directly verified against the provider's own documented filter schema.

---

## Topic 3 — Retrieval Strategy (target-seeking pagination)

**Why this decision exists**: a single fixed-size fetch (e.g. "get 10 companies") does not guarantee
enough *qualifying* candidates survive into the next phase, since Discovery's hard gates alone will reject
some fraction of any given page.

**Evidence**: this was previously identified directly in this project (not from external research) — an
earlier fixed-limit approach produced fewer usable candidates than the daily target required, motivating a
switch to paginated, target-seeking retrieval.

**Interpretation**: no new evidence gathered in this phase; carried forward from the existing, already
-implemented design.

**Decision Logic**: the Discovery Agent requests pages of candidates from the source and continues
requesting additional pages, following the source's pagination cursor, until either (a) the day's target
company count is reached, or (b) a safety cap on total companies checked is hit — whichever comes first.

**Final Decision**: retain the existing target-seeking pagination design (`run_signal_discovery`'s
page-loop, `discover_company_page`'s cursor handling), unchanged.

**Confidence**: High — already implemented and observed working in practice.

---

## Topic 4 — Normalization

**Why this decision exists**: different discovery sources describe the same real-world attribute
differently — one provider's `"Healthcare"` is another's `"Health Care"` and a third's `"Hospitals &
Clinics"`. If Discovery ever queries more than one source (Topic 1's documented fallback option), or even
if Crustdata itself changes its own category labels over time, downstream phases (Qualification, Scoring)
must not silently treat those as different values.

**Evidence**: this is a direct architectural consequence of Topic 1's finding, not a new external research
item — the moment a second provider (Apollo, People Data Labs) is introduced for cross-validation, field
-level inconsistency becomes a real, concrete problem rather than a theoretical one.

**Interpretation**: normalization must happen inside the Discovery Agent, before results are handed to the
next phase — Qualification should never need to know which provider a company record originated from.

**Decision Logic**: every candidate record is mapped into one common internal schema before being added to
the candidate list. At minimum, the following fields are normalized: company name, industry (mapped to
Phase 2's fixed industry vocabulary — Healthcare, Pharma/Biotech, Medical Devices, Financial Services,
Insurance), HQ location, employee count, and domain (lower-cased, stripped of protocol/subdomain
variance, used as the canonical identifier — see Duplicate Detection below).

**Final Decision**: adopt normalization as a required step of the Discovery Agent workflow, positioned
immediately after query execution and before duplicate detection.

**Confidence**: High as an architectural requirement (the need is unambiguous); Medium on exact mapping
rules until a second provider is actually introduced and real field-value mismatches are observed.

**Notes / Limitations**: not yet implemented in code — `discover_company_page` currently passes through
Crustdata's field values largely as-is, which is not a problem while Crustdata is the sole source, but
becomes one the moment Topic 1's fallback option is exercised.

---

## Topic 5 — Duplicate Detection

**Why this decision exists**: target-seeking pagination (Topic 3) already means multiple pages of the same
source are fetched in one run; introducing a second source (Topic 1) or re-running Discovery on a later
day makes duplicate candidate records a certainty, not an edge case.

**Evidence**: directly implied by Topics 1 and 3 together — no external research needed to establish that
paginating a single source, or querying more than one source, produces overlapping records.

**Interpretation**: a duplicate that reaches the next phase is not a harmless redundancy — it causes the
same company to be scored, and potentially reached out to, more than once, wasting the same per-result
Deepline costs already identified as a concern in this project.

**Decision Logic**: candidates are deduplicated using **domain as the primary identifier** — two records
with the same normalized domain are the same company. When domain is missing or unreliable, **company
name + HQ location** is used as a fallback identifier. Deduplication runs after normalization (Topic 4),
since it depends on domain values already being in a consistent form.

**Final Decision**: adopt domain-primary, name+HQ-fallback deduplication as a required step of the
Discovery Agent workflow.

**Confidence**: High — domain-based deduplication is a standard, low-ambiguity approach once normalization
is in place.

**Notes / Limitations**: not yet implemented in code. This is separate from, and in addition to, the
existing cross-day dedupe logic in `autonomous_orchestrator.py` (`_dedupe_against_prior_days`), which
compares against *prior batches* — this topic covers deduplication *within a single discovery run*, a
different problem the current code does not yet address at all.

---

## Topic 6 — Failure Handling

**Why this decision exists**: the current implementation has no defined behavior if the discovery
provider is unavailable, rate-limited, or returns a partial/malformed response — a real operational gap
for a system meant to run unattended once daily.

**Evidence**: not externally researched — this is a direct gap identified by reviewing the current
implementation against what an unattended daily system requires.

**Interpretation**: silent failure or an uncaught exception mid-run is the worst outcome for an autonomous
system, since it can leave a batch in an inconsistent state (a problem this project has already
encountered once, documented in the session log's crash-recovery work).

**Decision Logic**: on a discovery provider failure, the Discovery Agent follows a defined escalation:
retry the request a bounded number of times, then fall back to the documented alternate provider if one is
configured (Topic 1), and if no fallback is available or it also fails, abort the run cleanly and surface
an alert — rather than continuing with a partial or empty candidate list as if it were complete.

**Final Decision**: adopt this retry → fallback → abort-with-alert sequence as the Discovery Agent's
required failure-handling behavior.

**Confidence**: Medium — the sequence itself is a standard pattern, but no fallback provider is actually
configured yet (Topic 1 only documents Apollo/PDL as *available*, not wired in), so "fallback" is
currently an unimplemented branch, not a working safety net.

**Notes / Limitations**: not yet implemented in code. `execute_tool` in `app/deepline_client.py` currently
raises a `DeeplineError` on failure with no retry or fallback logic — this is the concrete point where
this decision would be implemented.

---

## Topic 7 — Architecture Review Finding: Separation of Discovery from Qualification

**Why this matters**: this is not a new criterion, but a structural finding about the current
implementation that affects how this phase should be understood going forward.

**Evidence**: the generic ABM framework explicitly separates "Company Discovery" (Phase 3) from "Company
Qualification" (Phase 4) — Discovery's stated output is only a candidate list, with qualification
(business/operational/strategic/commercial fit) handled entirely in the next phase. The system's current
implementation does not maintain this separation: `run_signal_discovery` performs company discovery
*and* a hiring-signal check (an early qualification/buying-intent activity) inside a single function,
and only companies that pass the signal check are retained at all.

**Interpretation**: this does not mean the hiring-signal check is wrong — it means it is currently
mis-labeled as part of Discovery when it structurally belongs to Qualification (or more precisely, to
Buying Signal Intelligence, a phase not yet formally documented). The practical effect today is that
"Discovery" as currently coded already performs a qualification step inline, rather than handing an
unfiltered candidate list to a separate qualification phase.

**Decision Logic**: not applicable — this is a documented architectural observation, not a criterion the
Discovery Agent evaluates.

**Final Decision**: no code change is made in this phase. This finding is carried forward as the explicit
opening problem for the next phase (Company Qualification) to resolve — that phase should formally define
where the hiring-signal check belongs, rather than this phase silently absorbing it.

**Confidence**: High — this is a direct comparison between documented framework and current code, not an
external research finding.

---

## Output

This phase produces a raw candidate list, each entry carrying only what the discovery source itself
returns (post-normalization) — no signal data, no score, no qualification judgment:

```
{
  "candidates": [
    {
      "name": "...",
      "domain": "...",
      "employee_count": 0,
      "industry": "...",
      "hq_location": "...",
      "source": "crustdata_companydb_search"
    }
  ],
  "discovery_metadata": {
    "target_requested": 0,
    "companies_checked": 0,
    "discovered_companies": 0,
    "duplicate_companies_removed": 0,
    "normalization_failures": 0,
    "pages_fetched": 0,
    "query_timestamp": "...",
    "provider_version": "...",
    "source": "crustdata"
  }
}
```

The next phase (Company Qualification) receives this candidate list as its sole input, and is responsible
for resolving Topic 7's finding above — explicitly defining whether hiring-signal detection belongs to
Qualification or to a separate Buying Signal Intelligence phase, rather than inheriting it as an
already-applied filter.

---

## Cross-references
- **Consumed from**: Phase 2 (`phase2-icp.md`) — ICP hard gates
- **Produced for**: Phase 4 (Company Qualification, not yet documented) — raw candidate list
- Existing implementation referenced: `app/phases/signal_discovery.py` (`discover_company_page`,
  `run_signal_discovery`), `app/deepline_client.py` (`execute_tool`)
- Open architectural question handed to the next phase: separation of hiring-signal detection from
  Discovery (Topic 7 above)
