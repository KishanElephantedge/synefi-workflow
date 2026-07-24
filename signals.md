# Synefi — Phase 1 Signal Taxonomy

Scope: LinkedIn only (per team lead). ICP: regulated industries — Pharma, Biotechnology, Medical Equipment/Devices, Hospitals & Health Care.

Synefi = AI consulting/software dev agency helping companies build AI systems, integrations, workflows, and automations safely/compliantly. Target leads = companies that want/need to build AI but need external help or leadership.

---

## 1. Job Posting Signals (active project initiation)
- AI/Agentic Builder Roles — AI Engineer, LLM Engineer, Generative AI Developer, RAG Specialist (building custom AI in-house)
- AI Leadership Roles — Head/Director/VP of AI or Artificial Intelligence
- AI Governance/Compliance Roles — titles/descriptions referencing "AI Governance," "Responsible AI," "AI Risk," or explicit frameworks (FDA AI/ML guidance, NIST AI RMF, ISO 42001). Closest direct match to Synefi's "safe agentic AI for regulated industries" pitch.
- Recruiting Signals — Founding Technical Recruiter focused on AI/ML (signals long-term AI dept scaling)
- Consulting/Contractor Roles — AI Consultant, Interim AI Project Lead (short-term gap, prime fit for an agency)
- Legacy Modernization Roles — postings to migrate legacy health/pharma systems or automate document processing/regulatory compliance workflows (automation initiative even without "AI" in the title)

Search query starting points:
- "AI" AND ("Product Manager" OR "PM" OR "Consultant" OR "Architect")
- "Artificial Intelligence" AND ("Lead" OR "VP" OR "Director" OR "Head")
- "Generative AI" OR "LLM" OR "Agentic" OR "LangChain" OR "LlamaIndex"
- "Founding Recruiter" OR "Technical Recruiter" AND ("AI" OR "Machine Learning")
- Industry filters: Pharmaceuticals, Biotechnology, Medical Equipment Manufacturing, Hospitals and Health Care

## 2. People & Title Change Signals (new decision-makers)
- Newly promoted/hired AI leaders (VP/Director/Head of AI or Automation) in the last 1–3 months — high pressure to deliver a quick win, receptive to outside help
- Newly appointed technical/product CXOs (CTO, CIO, VP Eng, CPO) — often reviews stack and kicks off modernization shortly after joining

## 3. Content & Activity Signals (pre-hire research phase)
- Company posts/press releases about implementing AI in clinical trials, medical writing, exploring agentic workflows for compliance, attending/speaking at AI summits
- Funding rounds or cloud/AI partnership announcements (e.g. AWS/Google/Microsoft/Nvidia deals) surfacing via company LinkedIn posts/press releases
- Employee post activity — execs posting/commenting about AI challenges, requesting vendor recommendations, sharing views on agentic systems
- Event attendees — people interacting with LinkedIn Events on "AI in Pharma/Healthcare," "Agentic AI for compliance," etc.
- Failed AI pilot mentions — public commentary referencing a stalled/failed internal AI pilot ("needs a compliant redo with outside help" segment)

## 4. Technical Stack & Vendor Signals (adoption indicators)
- Job descriptions mentioning modern AI infra keywords — LangChain, LlamaIndex, OpenAI API, Anthropic, Pinecone, Qdrant, vLLM (actively working with the modern stack, may need help scaling it securely)

## 5. Warm/Engagement Signals
- People at target-industry companies already engaging (liking/commenting/sharing) with Synefi's own LinkedIn content, or with competitors'/adjacent case studies on agentic AI in regulated industries — a pre-qualified, warmer signal

## 6. Organizational Change Signals
- M&A of an AI/automation startup by a pharma/health/medtech company (capability-building via acquisition, often still needs integration help)
- Restructuring/layoff announcement paired with concurrent AI-role hiring (signals AI-driven transformation, not just headcount growth)

## 7. Board/Advisor Signals
- A person's LinkedIn profile showing a new "AI Advisor" or "AI Board Member" appointment at a target-industry company — often precedes a leadership hire and budget commitment

---

## Appendix — Future Expansion (not LinkedIn, not in scope now)
Noted so they aren't lost when the source scope expands beyond LinkedIn later:
- FDA 510(k)/PMA filings mentioning AI/ML components (public FDA database)
- AI/automation-related patent filings by target-industry companies

---

## Scoring note (for Phase 2, not decided yet)
Signal stacking matters: a company matching multiple signals across categories (e.g. a funding raise + an AI governance hire + several AI-related job posts) is a far stronger target than one matching a single signal. Tier 1 (Job Posting §AI Governance/Compliance, People §New AI Leaders) should likely be weighted higher than Tier 3 (Content/Activity) when scoring is designed.

---

## Execution Mechanics — v1 vs v2 vs Fallback

### v1 — build now (compliant, provider-backed, reliable)
Sourced through Deepline's existing integrations, orchestrated via Claude Code, no raw LinkedIn scraping under our own account.

| Signal category | Provider(s) in Deepline | Status |
|---|---|---|
| 1. Job Posting Signals | PredictLeads (hiring/job-change signals), TheirStack (hiring + tech filters), Sentrion (company-specific job search) | Covered |
| 4. Technical Stack & Vendor Signals | TheirStack, BuiltWith, Bloomberry (technographics) | Covered |
| 2. People & Title Change Signals — "moved to a new company" half only | PredictLeads / Datagma (job-change data) | Covered (job-change only; internal promotions not confirmed — see v2) |

Cadence: daily batch scan (not hourly) — matches the 60–120 day job-posting-to-purchase window found in research; avoids unnecessary polling complexity/cost.

### v2 — add later (needs a dedicated mechanism beyond Deepline's current providers)

**Near-term / low-risk (public filings & press wires, not LinkedIn scraping):**
- Category 6 (Organizational Change — M&A, funding, layoffs): check first whether PredictLeads' "news-based intelligence" (already in Deepline) already covers this. If not fully covered, supplement with:
  - **Company Funding Tracker** (Apify) — SEC Form D filing scraper, real-time funding data
  - **Press Release Monitor** / **Company News & Announcement Finder** (Apify) — pulls PR Newswire, GlobeNewswire, SEC filings, RSS feeds
  - These read public filings/wire releases, not LinkedIn — no LinkedIn ToS exposure.

**Higher-risk (direct LinkedIn scraping — same legal/ToS exposure that led to Proxycurl's shutdown):**
- Category 3 (Content & Activity — company posts, exec commentary, press releases about AI plans):
  - Apify: *LinkedIn Company Posts Scraper*, *LinkedIn Profile Posts Scraper*
- Category 5 (Warm/Engagement — who liked/commented on a post):
  - Apify: *LinkedIn Posts Engagers (Likers and Commenters)*
  - PhantomBuster: *LinkedIn Post Commenter and Liker Scraper*
  - Alternatives: Vayne, BeReach (browser-extension based)
- Category 7 (Board/Advisor Signals):
  - No dedicated tool found. Best available approach: periodically scrape target profiles and diff the position/title field over time to catch new "Advisor"/board appointments — same underlying scraping mechanism and risk as above.
- Category 2 (People & Title Change) — "internal promotion, same company" half:
  - Not confirmed covered by any provider (job-change APIs typically track company moves, not internal title changes). Likely needs the same profile-diffing approach as category 7.

These all explicitly operate against LinkedIn's ToS ("every LinkedIn post scraper operates in a gray area" — search finding). Building any of these requires an explicit risk-acceptance decision from the team/team lead before implementation — not a default "we'll just add it later."

### Fallback — custom cron+script scraper
Kept as a secondary, risk-accepted option for boosting volume beyond what Deepline's compliant providers return, if v1 coverage proves insufficient. Not built by default; requires the same risk sign-off as the v2 LinkedIn-scraping tools above (rotating residential proxies, rate-limiting, session isolation from the main business account, fingerprint management as mitigations if pursued). No n8n — orchestration stays in custom scripts/Claude Code.
