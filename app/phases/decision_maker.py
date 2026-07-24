from sqlalchemy.orm import Session

from app.db.models import Company, Contact, Parameter
from app.deepline_client import execute_tool, extract_rows

# Persona-based targeting (replaces the earlier company-size waterfall). Each persona has
# its own title hierarchy, tried in priority order, stop at first hit. Each step is billed
# only if it returns a match (0 results = free), so trying steps in order costs nothing
# extra for the misses.
DEFAULT_PERSONA_WATERFALLS = {
    "engineering_leader": [
        ["VP Engineering", "VP of Engineering"],
        ["Director of Engineering"],
        ["Head of Engineering"],
        ["Engineering Manager"],
    ],
    "product_leader": [
        ["Product Director", "Director of Product"],
        ["Product Manager"],
        ["Head of Product", "Product Management"],
    ],
    "recruiting_leader": [
        ["Sr. Recruiter", "Senior Recruiter"],
        ["Technical Recruiter"],
        ["Chief of Staff"],
    ],
}

# Broader last-resort step per persona, tried only after every exact-title waterfall step
# above has missed. A company can have the right *function* without using any of our exact
# title strings (e.g. "Head of Product & Engineering", a founder wearing the eng-lead hat,
# a recruiter titled "People Ops Lead") -- department+seniority catches those instead of
# silently giving up on the persona. Same page_size=1 cost profile: free on a miss.
PERSONA_FALLBACK_FILTERS = {
    "engineering_leader": {"departments": ["Engineering"], "seniorities": ["Director", "Manager", "Senior"]},
    "product_leader": {"departments": ["Product"], "seniorities": ["Director", "Manager", "Senior"]},
    "recruiting_leader": {"departments": ["Human Resources", "Talent Acquisition"], "seniorities": ["Director", "Manager", "Senior"]},
}


def get_persona_waterfalls(db: Session, tenant_id: int) -> dict:
    param = (
        db.query(Parameter)
        .filter(Parameter.tenant_id == tenant_id)
        .filter(Parameter.key == "persona_titles")
        .first()
    )
    if param and param.value:
        return param.value
    return DEFAULT_PERSONA_WATERFALLS


def _run_search_contact(company: Company, extra_payload: dict) -> list[dict]:
    payload = {
        "domain": company.domain,
        # search_contact is billed per result returned (confirmed: a single hit with the
        # default page_size=10 cost 11.21 credits / ~$1.12 in testing). find_persona_contact
        # only ever uses persons[0], so requesting more than 1 just pays for rows we discard.
        "page_size": 1,
        **extra_payload,
    }
    response = execute_tool("search_contact", payload)
    raw = response.get("toolResponse", {}).get("raw", {})
    if isinstance(raw, dict) and isinstance(raw.get("output"), dict):
        persons = raw["output"].get("persons")
        if isinstance(persons, list):
            return persons
    return extract_rows(response, "persons")


def _make_contact(company: Company, db: Session, persons: list[dict], persona: str, reasoning: str) -> Contact:
    person = persons[0]
    contact = Contact(
        company_id=company.id,
        first_name=person.get("first_name"),
        last_name=person.get("last_name"),
        title=person.get("title"),
        linkedin_url=person.get("linkedin_url") or person.get("linkedin"),
        thread_role=persona,
        matched_title_reasoning=reasoning,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


def find_persona_contact(company: Company, db: Session, persona: str, waterfalls: dict) -> Contact | None:
    """Walk a persona's exact-title waterfall first, stop at the first step that returns a
    person. If every title step misses, fall back to one broader department+seniority search
    (PERSONA_FALLBACK_FILTERS) before giving up -- a company can have the right function
    under a title we didn't anticipate. Still skipped (not a failure) if even that misses."""
    waterfall = waterfalls[persona]

    for step_index, titles in enumerate(waterfall):
        persons = _run_search_contact(company, {"title_lists": [{"name": f"{persona}_step_{step_index}", "titles": titles}]})
        if persons:
            return _make_contact(company, db, persons, persona, f"persona={persona}, step={step_index}, titles={titles}")

    fallback = PERSONA_FALLBACK_FILTERS.get(persona)
    if fallback:
        persons = _run_search_contact(company, fallback)
        if persons:
            return _make_contact(company, db, persons, persona, f"persona={persona}, fallback department/seniority={fallback}")

    return None


def run_decision_maker_id(batch_id: int, db: Session, tenant_id: int) -> dict:
    """Phase 3 entrypoint: for every Hot/Warm company, search all 3 personas
    (Engineering Leader, Product Leader, Recruiting Leader) -- up to 3 contacts per company.
    A persona with no matching title at a company is simply skipped, not a failure. Persona
    titles are read from tenant_id's own Parameter row, so each tenant can run its own persona
    definitions (e.g. Elephant Edge's sales/GTM-focused personas vs Synefi's engineering/
    product/recruiting ones) without touching the other's configuration."""
    companies = (
        db.query(Company)
        .filter(Company.batch_id == batch_id)
        .filter(Company.score.has(tier="hot") | Company.score.has(tier="warm"))
        .all()
    )

    waterfalls = get_persona_waterfalls(db, tenant_id)
    contacts_by_persona = {p: 0 for p in waterfalls}
    companies_with_no_contact = 0

    for company in companies:
        found_any = False
        for persona in waterfalls:
            contact = find_persona_contact(company, db, persona, waterfalls)
            if contact:
                contacts_by_persona[persona] += 1
                found_any = True
        if not found_any:
            companies_with_no_contact += 1  # holding state, not excluded

    return {
        "companies_checked": len(companies),
        "contacts_by_persona": contacts_by_persona,
        "total_contacts_found": sum(contacts_by_persona.values()),
        "companies_with_no_contact": companies_with_no_contact,
    }
