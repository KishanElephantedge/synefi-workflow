from datetime import datetime

from sqlalchemy.orm import Session

from app.db.models import Company, Score, Signal

# Sub-industry fit tiers (Component B). No hard exclusion anymore (see signal_discovery.py
# note) -- industry now only affects the Fit component, per phase2-scoring.md's updated Rule-1.
HIGH_FIT_KEYWORDS = ["pharma", "biotech", "medical", "health"]
MEDIUM_FIT_KEYWORDS = ["fintech", "financial", "insurance", "legal", "law"]

# Component A: Signal Strength point values, keyed by how we classify a job_posting title.
LEADERSHIP_TITLE_MARKERS = ["vp", "vice president", "director", "head", "chief"]
BUILDER_TITLE_MARKERS = ["engineer", "developer", "llm", "agent", "rag", "scientist"]

SIGNAL_STRENGTH_POINTS = {
    "ai_leadership": 40,
    "ai_builder": 35,
    "tech_stack": 25,
    "general": 10,
}


def _recency_multiplier(fired_at: datetime) -> float:
    age_days = (datetime.utcnow() - fired_at).days
    if age_days <= 30:
        return 1.0
    if age_days <= 60:
        return 0.75
    if age_days <= 90:
        return 0.5
    return 0.0


def _classify_signal_strength(signal: Signal) -> str:
    if signal.category == "tech_stack":
        return "tech_stack"
    title = (signal.signal_type or "").lower()
    if any(m in title for m in LEADERSHIP_TITLE_MARKERS) and "ai" in title:
        return "ai_leadership"
    if any(m in title for m in BUILDER_TITLE_MARKERS):
        return "ai_builder"
    return "general"


def _score_signal_strength(signals: list[Signal]) -> tuple[float, dict]:
    """Max 40 pts. Take the highest applicable value after recency decay, don't sum duplicates."""
    best_points = 0.0
    best_detail = None
    for signal in signals:
        if signal.category not in ("job_posting", "tech_stack"):
            continue
        kind = _classify_signal_strength(signal)
        base_points = SIGNAL_STRENGTH_POINTS[kind]
        decayed = base_points * _recency_multiplier(signal.fired_at)
        if decayed > best_points:
            best_points = decayed
            best_detail = {"signal_type": signal.signal_type, "kind": kind, "base_points": base_points, "decayed_points": decayed}
    return best_points, {"best_signal": best_detail}


def _score_icp_fit(company: Company) -> tuple[float, dict]:
    """Max 40 pts: sub-industry fit (20) + company size (20)."""
    industry = (company.industry or "").lower()
    if any(k in industry for k in HIGH_FIT_KEYWORDS):
        fit_points, fit_tier = 20, "high"
    elif any(k in industry for k in MEDIUM_FIT_KEYWORDS):
        fit_points, fit_tier = 10, "medium"
    else:
        fit_points, fit_tier = 0, "low"

    count = company.employee_count or 0
    if 50 <= count <= 500:
        size_points, size_tier = 20, "sweet_spot"
    elif 500 < count <= 5000:
        size_points, size_tier = 15, "enterprise"
    elif count < 50:
        size_points, size_tier = 5, "seed"
    else:
        size_points, size_tier = 0, "unclassified"

    return fit_points + size_points, {
        "sub_industry_fit": {"tier": fit_tier, "points": fit_points},
        "company_size": {"tier": size_tier, "points": size_points, "employee_count": count},
    }


def _score_financial_growth(signals: list[Signal]) -> tuple[float, dict]:
    """Max 15 pts. Funding event in last 6 months (already pre-filtered in Phase 1's query).
    Headcount-growth sub-component has no data source yet -- left at 0 until wired in."""
    financing = [s for s in signals if s.category == "financing_event"]
    if financing:
        return 15.0, {"funding_event": True, "count": len(financing)}
    return 0.0, {"funding_event": False, "note": "headcount-growth data source not implemented"}


def _score_compliance_complexity() -> tuple[float, dict]:
    """Max 25 pts. Needs contact-title data (Clinical Trials/Regulatory Affairs/QA roles) and
    FDA pipeline data -- neither exists yet (Phase 3/4 territory). Always 0 until built."""
    return 0.0, {"note": "not implemented - requires Phase 3 contact/title data and FDA pipeline lookup"}


def _score_greenfield_legacy() -> tuple[float, dict]:
    """-10 to +15 pts. Needs in-house AI/ML headcount data -- no data source yet. Always 0."""
    return 0.0, {"note": "not implemented - requires in-house AI/ML headcount data"}


def _score_stacking_bonus(signals: list[Signal]) -> tuple[float, dict]:
    """Max 30 pts based on number of distinct signal categories present."""
    categories = {s.category for s in signals}
    if len(categories) >= 3:
        points = 30
    elif len(categories) >= 2:
        points = 15
    else:
        points = 0
    return float(points), {"distinct_categories": sorted(categories), "points": points}


def _tier_for_score(total: float) -> str:
    """Thresholds recalibrated 2026-07-23: for now, total_score is signal_strength ONLY
    (max 40) -- icp_fit/financial_growth/compliance_complexity/greenfield_legacy/stacking_bonus
    are still computed and stored in `breakdown` for future research, but deliberately left
    out of the total per an explicit request to score purely on hiring signal until the other
    components are properly designed. Re-add them to `total` in score_company below (and
    re-raise these thresholds back toward the old 100/60) once that research is done."""
    if total >= 35:
        return "hot"
    if total >= 15:
        return "warm"
    if total >= 1:
        return "cool"
    return "excluded"


def score_company(company: Company, db: Session) -> Score:
    signals = company.signals

    signal_strength, signal_detail = _score_signal_strength(signals)
    icp_fit, fit_detail = _score_icp_fit(company)
    financial_growth, financial_detail = _score_financial_growth(signals)
    compliance_complexity, compliance_detail = _score_compliance_complexity()
    greenfield_legacy, greenfield_detail = _score_greenfield_legacy()
    stacking_bonus, stacking_detail = _score_stacking_bonus(signals)

    total = signal_strength  # other components computed above are stored below for later, not counted yet
    tier = _tier_for_score(total)

    breakdown = {
        "signal_strength": signal_detail,
        "icp_fit": fit_detail,
        "financial_growth": financial_detail,
        "compliance_complexity": compliance_detail,
        "greenfield_legacy": greenfield_detail,
        "stacking_bonus": stacking_detail,
    }

    score = company.score
    if score is None:
        score = Score(company_id=company.id)
        db.add(score)

    score.signal_strength = signal_strength
    score.icp_fit = icp_fit
    score.financial_growth = financial_growth
    score.compliance_complexity = compliance_complexity
    score.greenfield_legacy = greenfield_legacy
    score.stacking_bonus = stacking_bonus
    score.total_score = total
    score.tier = tier
    score.passed_industry_gate = True  # gate removed -- kept as True for schema compatibility
    score.computed_at = datetime.utcnow()
    score.breakdown = breakdown

    return score


def run_scoring(batch_id: int, db: Session) -> dict:
    """Phase 2 entrypoint: score every company in the batch. Pure local computation over
    Phase 1's DB rows -- no external API calls, no Deepline credits spent."""
    companies = db.query(Company).filter(Company.batch_id == batch_id).all()

    tier_counts = {"hot": 0, "warm": 0, "cool": 0, "excluded": 0}
    for company in companies:
        score = score_company(company, db)
        tier_counts[score.tier] += 1
    db.commit()

    return {
        "companies_scored": len(companies),
        "tier_counts": tier_counts,
    }
