from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.db.models import Company, Parameter, Signal
from app.deepline_client import execute_tool, extract_rows

# No industry gate here by design: the manual run this pipeline replicates was never
# restricted to pharma/health (see july-worksheet-14-companies), it followed the AI-hiring
# signal wherever it led. Industry fit is scored (not filtered) in Phase 2 instead.

# Signal categories implemented in v1 (provider-backed, no LinkedIn-scraping risk):
#   - job_posting: AI/agentic hiring signals (this file)
#   - tech_stack: modern AI infra keywords in job descriptions (this file)
#   - job_change (people moving into an AI leadership title): deferred to Phase 3,
#     since the only provider (datagma_job_change_detection) checks a *known* contact,
#     and Phase 1 has no contacts yet.
# Not implemented (deferred to v2, needs LinkedIn-scraping risk sign-off per signals.md):
#   - content_activity, warm_engagement, org_change, board_advisor

# Tier 1/2 job-title keywords from signals.md's Job Posting Signals category
# (builder roles, AI leadership, AI governance/compliance, founding AI recruiter,
# AI consultant/interim, legacy-modernization). Fuzzy-contains match against job titles.
# This is Synefi's DEFAULT keyword set only -- each tenant can override it via the
# "hiring_signal_keywords" Parameter (see get_hiring_signal_keywords below). Elephant Edge,
# for example, needs sales/GTM-hiring keywords instead of AI-hiring keywords.
DEFAULT_SIGNAL_TITLE_KEYWORDS = [
    "AI",
    "Artificial Intelligence",
    "Machine Learning",
    "Agentic",
    "LLM",
    "Automation",
    "Generative AI",
    "AI Governance",
    "Responsible AI",
    "AI Risk",
    "Founding Recruiter",
    "AI Consultant",
    "Legacy Modernization",
    "AI PM",
    "AI Product Manager",
    "Technical Recruiter",
]

# Category 4 (Technical Stack & Vendor Signals): modern AI infra keywords searched
# against job posting full text via bloomberry_search_job_postings.
TECH_STACK_KEYWORDS = "LangChain OR LlamaIndex OR OpenAI API OR Anthropic OR Pinecone OR Qdrant OR vLLM"

# Default employee-count ICP band -- Synefi's. Each tenant can override via the
# "icp_employee_range" Parameter (see get_icp_employee_range below).
DEFAULT_EMPLOYEE_COUNT_MIN = 100
DEFAULT_EMPLOYEE_COUNT_MAX = 500


def get_icp_employee_range(db: Session, tenant_id: int) -> tuple[int, int]:
    param = (
        db.query(Parameter)
        .filter(Parameter.tenant_id == tenant_id)
        .filter(Parameter.key == "icp_employee_range")
        .first()
    )
    if param and param.value and "min" in param.value and "max" in param.value:
        return int(param.value["min"]), int(param.value["max"])
    return DEFAULT_EMPLOYEE_COUNT_MIN, DEFAULT_EMPLOYEE_COUNT_MAX


def get_hiring_signal_keywords(db: Session, tenant_id: int) -> list[str]:
    param = (
        db.query(Parameter)
        .filter(Parameter.tenant_id == tenant_id)
        .filter(Parameter.key == "hiring_signal_keywords")
        .first()
    )
    if param and param.value and "keywords" in param.value:
        return list(param.value["keywords"])
    return DEFAULT_SIGNAL_TITLE_KEYWORDS


def discover_company_page(batch_id: int, db: Session, tenant_id: int, page_size: int, cursor: str | None = None) -> tuple[list[Company], str | None]:
    """One page of structured company search via CrustData. Industry-agnostic (see note
    above) -- scoped only by HQ country and an exact employee-count range (numeric
    filter on employee_metrics.latest_count, not the coarser bucket enum), read from
    tenant_id's own ICP configuration. Returns the page's Company rows plus a pagination
    cursor for the next page, if any."""
    employee_min, employee_max = get_icp_employee_range(db, tenant_id)
    payload = {
        "filters": [
            {"filter_type": "hq_country", "type": "=", "value": "USA"},
            {"filter_type": "employee_metrics.latest_count", "type": "=>", "value": employee_min},
            {"filter_type": "employee_metrics.latest_count", "type": "=<", "value": employee_max},
        ],
        "limit": page_size,
    }
    if cursor:
        payload["cursor"] = cursor
    response = execute_tool("crustdata_companydb_search", payload)
    rows = extract_rows(response, "companies")
    raw = response.get("toolResponse", {}).get("raw", {})
    next_cursor = None
    if isinstance(raw, dict):
        next_cursor = (raw.get("meta") or {}).get("nextCursor")

    companies = []
    for row in rows:
        domain = row.get("company_website_domain") or (row.get("domains") or [None])[0]
        if not domain:
            continue
        industries = row.get("linkedin_industries") or row.get("crunchbase_categories") or []
        company = Company(
            batch_id=batch_id,
            name=row.get("company_name", "Unknown"),
            domain=domain,
            industry=", ".join(industries[:3]) if industries else None,
            employee_count=(row.get("employee_metrics") or {}).get("latest_count"),
            location=row.get("hq_location"),
        )
        db.add(company)
        companies.append(company)
    db.commit()
    for c in companies:
        db.refresh(c)
    return companies, next_cursor


def find_job_posting_signals(company: Company, db: Session, tenant_id: int) -> list[Signal]:
    """Query real job listings for this company, matched against tenant_id's own hiring
    -signal title keywords (Synefi: AI-hiring titles; Elephant Edge: sales/GTM-hiring titles).
    Returns the Signal rows created."""
    keywords = get_hiring_signal_keywords(db, tenant_id)
    payload = {
        "filters": {
            "op": "and",
            "conditions": [
                {"field": "company.basic_info.primary_domain", "type": "in", "value": [company.domain]},
                {
                    "op": "or",
                    "conditions": [
                        {"field": "job_details.title", "type": "(.)", "value": kw}
                        for kw in keywords
                    ],
                },
            ]
        },
        "limit": 20,
    }
    response = execute_tool("crustdata_v2_job_search", payload)
    listings = extract_rows(response, "job_listings")

    signals = []
    for listing in listings:
        details = listing.get("job_details", {})
        title = details.get("title", "")
        posted_date = listing.get("metadata", {}).get("date_updated") or listing.get("metadata", {}).get("date_added")
        fired_at = datetime.utcnow()
        if posted_date:
            try:
                fired_at = datetime.fromisoformat(posted_date.replace("Z", "+00:00")).replace(tzinfo=None)
            except ValueError:
                pass
        signal = Signal(
            company_id=company.id,
            category="job_posting",
            signal_type=title,
            detail=details.get("url", ""),
            fired_at=fired_at,
            source="crustdata_v2_job_search",
        )
        db.add(signal)
        signals.append(signal)
    db.commit()
    return signals


def find_tech_stack_signals(company: Company, db: Session) -> list[Signal]:
    """Query job posting full text for modern AI infra keywords
    (Technical Stack & Vendor Signals category from signals.md). Returns the Signal rows created."""
    payload = {
        "domain": company.domain,
        "keyword": TECH_STACK_KEYWORDS,
        "active_only": True,
        "limit": 20,
    }
    response = execute_tool("bloomberry_search_job_postings", payload)
    jobs = extract_rows(response, "jobs")

    signals = []
    for job in jobs:
        posted_date = job.get("snapshot_date") or job.get("created_at")
        fired_at = datetime.utcnow()
        if posted_date:
            try:
                fired_at = datetime.fromisoformat(posted_date.replace("Z", "+00:00")).replace(tzinfo=None)
            except ValueError:
                pass
        signal = Signal(
            company_id=company.id,
            category="tech_stack",
            signal_type=job.get("title", ""),
            detail=job.get("displayed_url", ""),
            fired_at=fired_at,
            source="bloomberry_search_job_postings",
        )
        db.add(signal)
        signals.append(signal)
    db.commit()
    return signals


def find_financing_signals(company: Company, db: Session) -> list[Signal]:
    """Fetch financing events from the last 6 months (Phase 2's Financial/Growth Intent
    component needs this). Not a keep/drop gate on its own -- only run for companies that
    already passed the job/tech signal check, so we don't spend credits on drops."""
    six_months_ago = (datetime.utcnow() - timedelta(days=182)).date().isoformat()
    payload = {
        "company_id_or_domain": company.domain,
        "first_seen_at_from": six_months_ago,
        "limit": 10,
    }
    response = execute_tool("predictleads_company_financing_events", payload)
    events = extract_rows(response, "data")

    signals = []
    for event in events:
        attrs = event.get("attributes", {})
        fired_at_raw = attrs.get("effective_date") or attrs.get("found_at")
        fired_at = datetime.utcnow()
        if fired_at_raw:
            try:
                fired_at = datetime.fromisoformat(fired_at_raw.replace("Z", "+00:00")).replace(tzinfo=None)
            except ValueError:
                pass
        signal = Signal(
            company_id=company.id,
            category="financing_event",
            signal_type=attrs.get("financing_type", "financing_event"),
            detail=str(attrs.get("amount", "")),
            fired_at=fired_at,
            source="predictleads_company_financing_events",
        )
        db.add(signal)
        signals.append(signal)
    db.commit()
    return signals


def run_signal_discovery(batch_id: int, db: Session, tenant_id: int, target: int = 5, page_size: int = 10, max_checked: int = 50) -> dict:
    """Phase 1 entrypoint: keep pulling pages of companies (scoped to tenant_id's own ICP
    employee-count range) and checking each for a hiring signal only, using tenant_id's own
    hiring-signal keywords (tech_stack/financing_event checks are temporarily disabled,
    cost-control decision, 2026-07-22 -- find_tech_stack_signals/find_financing_signals are
    kept below, just not called, so re-enabling later is a one-line change, not a rewrite)
    until `target` companies are kept, or `max_checked` total companies have been checked
    (safety cap so a bad day with no real signals can't run away pulling endless pages)."""
    kept_companies: list[Company] = []
    checked = 0
    dropped = 0
    signals_by_category = {"job_posting": 0}
    cursor = None

    while len(kept_companies) < target and checked < max_checked:
        page, cursor = discover_company_page(batch_id, db, tenant_id, page_size, cursor)
        if not page:
            break  # provider has no more companies matching the filters

        for company in page:
            checked += 1
            job_signals = find_job_posting_signals(company, db, tenant_id)
            signals_by_category["job_posting"] += len(job_signals)

            if job_signals:
                kept_companies.append(company)
            else:
                dropped += 1
                db.delete(company)  # no hiring signal -> not a discovery hit, drop the company row

            if len(kept_companies) >= target or checked >= max_checked:
                break
        db.commit()

        if not cursor:
            break  # provider says there's no next page

    return {
        "companies_checked": checked,
        "companies_kept": len(kept_companies),
        "companies_dropped_no_signal": dropped,
        "target": target,
        "target_reached": len(kept_companies) >= target,
        "total_signals_found": sum(signals_by_category.values()),
        "signals_by_category": signals_by_category,
    }
