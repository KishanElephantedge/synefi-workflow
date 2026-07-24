from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.db.models import AutonomousRun, Batch, Company, Parameter, Score
from app.deepline_client import get_credit_balance_usd
from app.phases.decision_maker import run_decision_maker_id
from app.phases.outreach import run_outreach_push
from app.phases.scoring import run_scoring
from app.phases.signal_discovery import run_signal_discovery

DEFAULT_DAILY_COMPANY_CAP = 5
DEFAULT_DAILY_BUDGET_USD = 1.0
DISCOVERY_PAGE_SIZE = 10  # companies fetched per page while searching for the day's target
DISCOVERY_MAX_CHECKED = 50  # safety cap on total companies checked in one day's discovery search
STALE_RUN_TIMEOUT_MINUTES = 120  # a "running" row this old means the process crashed mid-cycle, not that it's actually still running


def _get_tenant_param(db: Session, tenant_id: int, key: str) -> Parameter | None:
    return (
        db.query(Parameter)
        .filter(Parameter.tenant_id == tenant_id)
        .filter(Parameter.key == key)
        .first()
    )


def get_daily_budget_usd(db: Session, tenant_id: int) -> float:
    param = _get_tenant_param(db, tenant_id, "daily_credit_budget_usd")
    if param and param.value and "budget_usd" in param.value:
        return float(param.value["budget_usd"])
    return DEFAULT_DAILY_BUDGET_USD


def _clear_stale_running_flags(db: Session, tenant_id: int) -> None:
    cutoff = datetime.utcnow() - timedelta(minutes=STALE_RUN_TIMEOUT_MINUTES)
    stale_runs = (
        db.query(AutonomousRun)
        .join(Batch)
        .filter(Batch.tenant_id == tenant_id)
        .filter(AutonomousRun.status == "running")
        .filter(AutonomousRun.started_at < cutoff)
        .all()
    )
    for run in stale_runs:
        run.status = "failed"
        run.error_message = "Marked stale: exceeded max expected run time, likely a server restart mid-cycle"
        run.completed_at = datetime.utcnow()
    if stale_runs:
        db.commit()


def is_autonomous_enabled(db: Session, tenant_id: int) -> bool:
    param = _get_tenant_param(db, tenant_id, "autonomous_enabled")
    return bool(param and param.value and param.value.get("enabled") is True)


def get_daily_company_cap(db: Session, tenant_id: int) -> int:
    param = _get_tenant_param(db, tenant_id, "daily_company_cap")
    if param and param.value and "cap" in param.value:
        return int(param.value["cap"])
    return DEFAULT_DAILY_COMPANY_CAP


def _dedupe_against_prior_days(batch: Batch, db: Session) -> int:
    """Drop any company discovered today whose domain already exists in an earlier batch
    belonging to the SAME tenant -- already processed on a prior day, don't re-discover it.
    Scoped to batch.tenant_id so two tenants never dedupe against each other's companies."""
    todays_companies = db.query(Company).filter(Company.batch_id == batch.id).all()
    removed = 0
    for company in todays_companies:
        if not company.domain:
            continue
        prior_exists = (
            db.query(Company)
            .join(Batch)
            .filter(Company.domain == company.domain)
            .filter(Batch.tenant_id == batch.tenant_id)
            .filter(Company.batch_id != batch.id)
            .filter(Batch.status != "failed")  # a failed run's candidates were never actually
            .first()                            # processed/pushed, so they don't count as "done"
        )
        if prior_exists:
            db.delete(company)  # cascades are not configured, but Score/Signal/Contact rows
            removed += 1         # for a same-day-only company are removed via Phase1/2/3's own flow
    db.commit()
    return removed


def _select_top_companies(batch: Batch, db: Session, cap: int) -> int:
    """Keep only the top-N Hot/Warm companies by score for today's batch; drop the rest so
    they don't linger as half-processed rows and don't block future days' dedupe."""
    scored = (
        db.query(Company)
        .join(Score)
        .filter(Company.batch_id == batch.id)
        .filter(Score.tier.in_(["hot", "warm"]))
        .order_by(Score.total_score.desc())
        .all()
    )
    keep = scored[:cap]
    drop = scored[cap:]
    for company in drop:
        db.delete(company)
    db.commit()
    return len(keep)


def run_daily_autonomous_cycle(db: Session, tenant_id: int) -> dict:
    """The self-triggered daily cycle for ONE tenant: Phase 1 -> 2 -> select top 5 -> Phase 3
    (persona-based) -> Phase 5 (HeyReach push). Meant to be called once every 24 hours per
    tenant by a scheduler, not from the dashboard's manual per-phase buttons. All state
    (concurrency lock, dedupe, parameters, credentials) is scoped to tenant_id -- two tenants'
    cycles run fully independently and never block or see each other's data."""
    if not is_autonomous_enabled(db, tenant_id):
        return {"status": "skipped", "reason": "autonomous_enabled is off"}

    _clear_stale_running_flags(db, tenant_id)
    already_running = (
        db.query(AutonomousRun)
        .join(Batch)
        .filter(Batch.tenant_id == tenant_id)
        .filter(AutonomousRun.status == "running")
        .first()
    )
    if already_running:
        return {
            "status": "skipped",
            "reason": "a cycle is already running",
            "running_since": already_running.started_at,
        }

    batch = Batch(tenant_id=tenant_id, name=f"autonomous-{datetime.utcnow().date().isoformat()}")
    db.add(batch)
    db.commit()
    db.refresh(batch)

    run = AutonomousRun(batch_id=batch.id, status="running")
    db.add(run)
    db.commit()
    db.refresh(run)

    budget_usd = get_daily_budget_usd(db, tenant_id)
    try:
        start_balance = get_credit_balance_usd()
    except Exception:
        start_balance = None  # billing check unavailable -- don't block the cycle over it, just skip the guard

    try:
        discovery_result = run_signal_discovery(
            batch.id, db, tenant_id=tenant_id,
            target=get_daily_company_cap(db, tenant_id),
            page_size=DISCOVERY_PAGE_SIZE,
            max_checked=DISCOVERY_MAX_CHECKED,
        )
        removed_dupes = _dedupe_against_prior_days(batch, db)
        run_scoring(batch.id, db)
        selected = _select_top_companies(batch, db, get_daily_company_cap(db, tenant_id))

        spent_so_far = None
        if start_balance is not None:
            spent_so_far = start_balance - get_credit_balance_usd()

        budget_stopped_early = spent_so_far is not None and spent_so_far >= budget_usd
        if budget_stopped_early:
            # Phase 1 alone already used the day's budget -- skip the paid decision-maker
            # search and the (then-pointless) outreach push rather than keep spending.
            decision_maker_result = {"companies_checked": 0, "contacts_by_persona": {}, "total_contacts_found": 0, "companies_with_no_contact": 0}
            outreach_result = {"contacts_checked": 0, "pushed": 0, "failed": 0, "skipped_no_linkedin": 0, "skipped_already_pushed": 0}
        else:
            decision_maker_result = run_decision_maker_id(batch.id, db, tenant_id=tenant_id)
            outreach_result = run_outreach_push(batch.id, db, tenant_id=tenant_id)

        final_spend = None
        if start_balance is not None:
            final_spend = start_balance - get_credit_balance_usd()

        batch.current_phase = "autonomous_cycle_done"
        batch.status = "complete"

        run.status = "completed"
        run.companies_discovered = discovery_result["companies_kept"]
        run.companies_selected = selected
        run.contacts_found = decision_maker_result["total_contacts_found"]
        run.contacts_pushed = outreach_result["pushed"]
        run.credits_spent_usd = final_spend
        run.budget_stopped_early = budget_stopped_early
        run.completed_at = datetime.utcnow()
        db.commit()

        return {
            "status": "completed",
            "batch_id": batch.id,
            "companies_discovered": discovery_result["companies_kept"],
            "duplicates_removed": removed_dupes,
            "companies_selected": selected,
            "decision_maker_result": decision_maker_result,
            "outreach_result": outreach_result,
            "credits_spent_usd": final_spend,
            "budget_stopped_early": budget_stopped_early,
            "budget_usd": budget_usd,
        }
    except Exception as e:
        db.rollback()  # required first: a failed flush/commit leaves the session unusable
        run.status = "failed"
        run.error_message = str(e)
        run.completed_at = datetime.utcnow()
        batch.status = "failed"
        db.add(run)
        db.add(batch)
        db.commit()
        return {"status": "failed", "batch_id": batch.id, "error": str(e)}
