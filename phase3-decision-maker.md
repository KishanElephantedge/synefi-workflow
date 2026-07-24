# Synefi — Phase 3: Decision-Maker Identification

Purpose: for each Hot/Warm company from Phase 2, identify the specific person/people who actually hold budget and authority to bring in an external agency for AI development — not a persona-matched title picked at random, which was the weak point of the original manual process (parallel Engineering/Product/Recruiting personas, unranked).

Research grounding (see sources at bottom):
- Healthcare/pharma tech buying is unusually committee-driven — average ~9 decision-makers touch a hospital/health-system purchase; for deals above ~$100K, expect at least one C-suite member involved.
- Multi-threading (contacting multiple people, not just one) measurably improves outcomes: teams contacting 3+ contacts see up to 30% higher win rates; closed-won deals average 2x more contacts than closed-lost ones.
- Compliance/Medical officers are best modeled as **gatekeepers who can stall or kill a deal**, not as people who generate pull — "they may not drive the deal forward, but they can stop it cold if something raises a red flag." Pitching them is about not getting silently blocked later, not about generating urgency.
- Where a Chief AI Officer role exists, it usually holds the actual AI budget (61% of CAIOs control it) and reports to the CEO — relevant mainly at larger enterprises that have created the role.

---

## Rule-1 (Triggering-Person Priority)

If the signal that qualified this company in Phase 2 was itself a named hire (e.g. "AI Leadership job post" or "New Executive Hire" identified an actual person who just became VP/Head of AI), that person is the default **Champion/primary technical contact**. They created the buying trigger, own the initiative, and are under pressure to deliver a quick win — the strongest possible match. Skip the fallback waterfall below when this applies.

## Rule-2 (Size-Based Targeting Waterfall) — used when Rule-1 doesn't identify a named person

**A. Seed & Early Stage (1–50 employees)**
- Target: CEO / Founder / Co-Founder (primary) + CTO / Chief Scientific Officer if the solution is deeply technical/clinical.
- Contacted together, single-threaded is fine — no real buying committee exists yet; the founder signs the check regardless of who else is in the room.

**B. Growth Stage (51–200 employees)**
- Target hierarchy: VP/Head of Engineering (owns build-vs-buy) → CPO/VP of Product (owns roadmap, knows the "why") → VP/Head of Data or AI, if that role exists (undisputed buyer if so).

**C. Mid-Market & Scale-Ups (201–1,000 employees)**
- Target hierarchy: VP of AI / VP of Data Science → VP of Digital Transformation / Head of Innovation (common in MedTech/Healthcare, tasked with modernizing legacy systems) → VP of R&D IT / VP of Clinical Systems (Pharma-specific: owns budget for automating clinical trials/drug discovery).

**D. Enterprise (1,000+ employees)**
- Target hierarchy: Director of AI / Director of Machine Learning (business-unit level) → Director of Commercial Innovation / Head of Digital Health → Director of Medical Affairs IT / Clinical Operations Tech Lead.
- Do not target C-suite or global CIO directly — unreachable and the wrong level for a services engagement; enterprise budgets live inside specific business units, not centrally.

## Rule-3 (Dual-Sided / Domain-Compliance Thread)

For companies **50+ employees**, always attempt a second, simultaneous thread alongside the technical Champion (Rule-1 or Rule-2 result): the highest-ranking Domain/Compliance contact — CMO, Chief Compliance Officer, VP Regulatory Affairs, or Head of Clinical Operations. This is Synefi's specific differentiator ("safe agentic AI for regulated industries") and functions as risk mitigation against a later stall, not as a primary demand generator — calibrate expectations accordingly; don't over-index on them responding first.

For companies **under 50 employees**, this second thread is optional/lower priority — a single technical/founder contact can usually move faster alone at this size, and a full dual-thread isn't justified yet.

## Rule-4 (Contact Cap & Simultaneous Threading)

Cap at **2 contacts per company by default** (Champion + Domain/Compliance), contacted **simultaneously**, not sequentially — the research shows multi-threading in parallel drives materially better outcomes than holding a second contact in reserve as a backup. Sequential backup-only-if-no-response was in an earlier draft of this design and is superseded by this rule.

A **3rd contact** (a VP-level economic buyer) is added only as a targeted exception at the Enterprise tier (1,000+), and only if enrichment data clearly identifies one distinct from the two threads above — not a default for every company.

## Rule-5 (No Match Found)

If no one matching the waterfall can be found/enriched at a qualifying company, it drops to a holding state (not excluded) and is re-attempted on the next Phase 1/2 cycle rather than wasting an outreach slot on a random weak match.

---

## Output
Up to 2 (exceptionally 3, Enterprise only) validated contacts per Hot/Warm company, each tagged with their thread role (Champion / Domain-Compliance / Economic Buyer), feeding into Phase 4 (enrichment + approach design per contact).

---

## Sources
- [How to Sell to Healthcare Organizations: A B2B Guide](https://salesmotion.io/blog/how-to-sell-to-healthcare)
- [Multi-Threaded Selling: Stop Losing Deals to One Champion](https://www.smarte.pro/blog/multi-threaded-sales)
- [Multithreading in sales: The B2B selling framework](https://www.highspot.com/blog/multithreading-in-sales/)
- [Chief AI Officer: Complete Guide to CAIO Role 2026](https://techjacksolutions.com/careers/ai-careers/chief-ai-officer/)
