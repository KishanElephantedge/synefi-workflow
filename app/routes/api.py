from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.cache import active_keys, bump_batch_version, cache_get, cache_set, get_batch_version, mark_active
from app.db.models import AutonomousRun, Batch, Company, Contact, Credential, Parameter, Score
from app.db.session import get_db
from app.phases.autonomous_orchestrator import is_autonomous_enabled, run_daily_autonomous_cycle
from app.phases.decision_maker import run_decision_maker_id
from app.phases.outreach import run_outreach_push
from app.phases.scoring import run_scoring
from app.phases.signal_discovery import run_signal_discovery
from app.heyreach_client import HeyReachError

router = APIRouter()

# This backend is dedicated to exactly one tenant -- Synefi (see the gateway's tenant
# directory, /Users/kishanbm/gateway, for the full tenant list and routing). It is not a
# second multi-tenant backend serving multiple tenants by client-supplied tenant_id; the
# gateway already resolved "which tenant" before ever proxying a request here. If Synefi's
# tenant_id in the shared `tenants` table ever changes, update this constant.
SYNEFI_TENANT_ID = 1


def _get_tenant_batch(batch_id: int, db: Session) -> Batch:
    batch = (
        db.query(Batch)
        .filter(Batch.id == batch_id)
        .filter(Batch.tenant_id == SYNEFI_TENANT_ID)
        .first()
    )
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


# ---- Batches ----

@router.post("/batches")
def create_batch(name: str, db: Session = Depends(get_db)):
    batch = Batch(tenant_id=SYNEFI_TENANT_ID, name=name)
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return {"id": batch.id, "name": batch.name, "status": batch.status}


@router.get("/batches")
def list_batches(db: Session = Depends(get_db)):
    batches = (
        db.query(Batch)
        .filter(Batch.tenant_id == SYNEFI_TENANT_ID)
        .order_by(Batch.created_at.desc())
        .all()
    )
    counts = dict(
        db.query(Company.batch_id, func.count(Company.id))
        .filter(Company.batch_id.in_([b.id for b in batches]))
        .group_by(Company.batch_id)
        .all()
    )
    return [
        {
            "id": b.id,
            "name": b.name,
            "created_at": b.created_at,
            "current_phase": b.current_phase,
            "status": b.status,
            "company_count": counts.get(b.id, 0),
        }
        for b in batches
    ]


@router.post("/batches/{batch_id}/phases/signal-discovery")
def execute_signal_discovery(batch_id: int, target: int = 5, db: Session = Depends(get_db)):
    batch = _get_tenant_batch(batch_id, db)
    result = run_signal_discovery(batch.id, db, tenant_id=SYNEFI_TENANT_ID, target=target)
    batch.current_phase = "signal_discovery_done"
    db.commit()
    bump_batch_version(batch_id)
    return result


@router.post("/batches/{batch_id}/phases/scoring")
def execute_scoring(batch_id: int, db: Session = Depends(get_db)):
    batch = _get_tenant_batch(batch_id, db)
    result = run_scoring(batch.id, db)
    batch.current_phase = "scoring_done"
    db.commit()
    bump_batch_version(batch_id)
    return result


@router.post("/batches/{batch_id}/phases/decision-maker")
def execute_decision_maker_id(batch_id: int, db: Session = Depends(get_db)):
    batch = _get_tenant_batch(batch_id, db)
    result = run_decision_maker_id(batch.id, db, tenant_id=SYNEFI_TENANT_ID)
    batch.current_phase = "decision_maker_done"
    db.commit()
    bump_batch_version(batch_id)
    return result


@router.post("/batches/{batch_id}/phases/outreach")
def execute_outreach_push(batch_id: int, db: Session = Depends(get_db)):
    batch = _get_tenant_batch(batch_id, db)
    try:
        result = run_outreach_push(batch.id, db, tenant_id=SYNEFI_TENANT_ID)
    except HeyReachError as e:
        raise HTTPException(status_code=400, detail=str(e))
    batch.current_phase = "outreach_done"
    db.commit()
    bump_batch_version(batch_id)
    return result


CACHE_TTL_SECONDS = 600  # generous -- the background refresher (main.py) keeps active
# batches' cache fresh well before this expires; it's just a ceiling for abandoned pages.


def _build_batch_payload(batch_id: int, page: int, page_size: int, db: Session) -> dict | None:
    """The actual DB work behind GET /batches/{id} -- factored out so both the request
    handler (cache miss / ?fresh=true) and the background refresher can produce the exact
    same shape without duplicating the query logic."""
    batch = (
        db.query(Batch)
        .filter(Batch.id == batch_id)
        .filter(Batch.tenant_id == SYNEFI_TENANT_ID)
        .first()
    )
    if not batch:
        return None

    # Summary counts are computed with SQL aggregates over the WHOLE batch, independent of
    # which page is loaded -- phase-progress logic (has scoring run? has a decision maker been
    # found for anyone?) needs to see the whole batch, not just whatever page happens to be
    # showing, so it can't be derived by scanning the (now paginated) companies list.
    total_companies = db.query(func.count(Company.id)).filter(Company.batch_id == batch.id).scalar()
    tier_rows = (
        db.query(Score.tier, func.count(Score.id))
        .join(Company, Company.id == Score.company_id)
        .filter(Company.batch_id == batch.id)
        .group_by(Score.tier)
        .all()
    )
    tier_counts = {tier: count for tier, count in tier_rows if tier}
    contacts_count = (
        db.query(func.count(Contact.id))
        .join(Company, Company.id == Contact.company_id)
        .filter(Company.batch_id == batch.id)
        .scalar()
    )

    companies = (
        db.query(Company)
        .filter(Company.batch_id == batch.id)
        .options(
            selectinload(Company.signals),
            selectinload(Company.score),
            selectinload(Company.contacts),
        )
        .order_by(Company.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return {
        "id": batch.id,
        "name": batch.name,
        "current_phase": batch.current_phase,
        "status": batch.status,
        "page": page,
        "page_size": page_size,
        "total_companies": total_companies,
        "summary": {
            "tier_counts": tier_counts,
            "scored_count": sum(tier_counts.values()),
            "contacts_count": contacts_count,
        },
        "companies": [
            {
                "id": c.id,
                "name": c.name,
                "domain": c.domain,
                "signal_count": len(c.signals),
                "score": c.score.total_score if c.score else None,
                "tier": c.score.tier if c.score else None,
                "contact_count": len(c.contacts),
            }
            for c in companies
        ],
    }


def _batch_cache_key(batch_id: int, page: int, page_size: int) -> str:
    version = get_batch_version(batch_id)
    return f"batch:{batch_id}:v{version}:p{page}:s{page_size}"


def refresh_active_batch_caches(db: Session):
    """Runs every few minutes (see main.py's scheduler) -- re-fetches and re-caches every
    batch page anyone actually loaded recently, so a real user's next click almost always
    hits a warm cache instead of racing a cold DB query. Cheap: only touches pages someone
    looked at in the last 30 minutes (see app/cache.py's active_keys)."""
    for logical_key in active_keys():
        try:
            batch_id_str, page_str, page_size_str = logical_key.split(":")
            batch_id, page, page_size = int(batch_id_str), int(page_str), int(page_size_str)
        except ValueError:
            continue
        payload = _build_batch_payload(batch_id, page, page_size, db)
        if payload is None:
            continue
        cache_set(_batch_cache_key(batch_id, page, page_size), payload, CACHE_TTL_SECONDS)


@router.get("/batches/{batch_id}")
def get_batch(batch_id: int, page: int = 1, page_size: int = 50, fresh: bool = False, db: Session = Depends(get_db)):
    page = max(page, 1)
    page_size = min(max(page_size, 1), 200)
    mark_active(f"{batch_id}:{page}:{page_size}")

    if not fresh:
        cached = cache_get(_batch_cache_key(batch_id, page, page_size))
        if cached is not None:
            return cached

    payload = _build_batch_payload(batch_id, page, page_size, db)
    if payload is None:
        raise HTTPException(status_code=404, detail="Batch not found")
    cache_set(_batch_cache_key(batch_id, page, page_size), payload, CACHE_TTL_SECONDS)
    return payload


# ---- Credentials (Settings page) ----

@router.get("/credentials")
def list_credentials(db: Session = Depends(get_db)):
    creds = db.query(Credential).filter(Credential.tenant_id == SYNEFI_TENANT_ID).all()
    # Never return raw values to the frontend - just whether it's set.
    return [{"name": c.name, "is_set": bool(c.value), "updated_at": c.updated_at} for c in creds]


@router.post("/credentials")
def upsert_credential(name: str, value: str, db: Session = Depends(get_db)):
    cred = (
        db.query(Credential)
        .filter(Credential.tenant_id == SYNEFI_TENANT_ID)
        .filter(Credential.name == name)
        .first()
    )
    if cred:
        cred.value = value
    else:
        cred = Credential(tenant_id=SYNEFI_TENANT_ID, name=name, value=value)
        db.add(cred)
    db.commit()
    return {"name": name, "is_set": True}


@router.delete("/credentials/{name}")
def delete_credential(name: str, db: Session = Depends(get_db)):
    cred = (
        db.query(Credential)
        .filter(Credential.tenant_id == SYNEFI_TENANT_ID)
        .filter(Credential.name == name)
        .first()
    )
    if cred:
        db.delete(cred)
        db.commit()
    return {"deleted": name}


# ---- Autonomous system control ----

@router.get("/autonomous/status")
def get_autonomous_status(db: Session = Depends(get_db)):
    last_run = (
        db.query(AutonomousRun)
        .join(Batch)
        .filter(Batch.tenant_id == SYNEFI_TENANT_ID)
        .order_by(AutonomousRun.started_at.desc())
        .first()
    )
    return {
        "enabled": is_autonomous_enabled(db, SYNEFI_TENANT_ID),
        "last_run": {
            "id": last_run.id,
            "run_date": last_run.run_date,
            "status": last_run.status,
            "companies_selected": last_run.companies_selected,
            "contacts_pushed": last_run.contacts_pushed,
        } if last_run else None,
    }


@router.post("/autonomous/toggle")
def toggle_autonomous(enabled: bool, db: Session = Depends(get_db)):
    param = (
        db.query(Parameter)
        .filter(Parameter.tenant_id == SYNEFI_TENANT_ID)
        .filter(Parameter.key == "autonomous_enabled")
        .first()
    )
    if param:
        param.value = {"enabled": enabled}
    else:
        param = Parameter(tenant_id=SYNEFI_TENANT_ID, key="autonomous_enabled", value={"enabled": enabled},
                           description="Start/pause the daily autonomous cycle")
        db.add(param)
    db.commit()
    return {"enabled": enabled}


@router.get("/autonomous/runs")
def list_autonomous_runs(db: Session = Depends(get_db)):
    runs = (
        db.query(AutonomousRun)
        .join(Batch)
        .filter(Batch.tenant_id == SYNEFI_TENANT_ID)
        .order_by(AutonomousRun.started_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "run_date": r.run_date,
            "batch_id": r.batch_id,
            "status": r.status,
            "companies_discovered": r.companies_discovered,
            "companies_selected": r.companies_selected,
            "contacts_found": r.contacts_found,
            "contacts_pushed": r.contacts_pushed,
            "credits_spent_usd": r.credits_spent_usd,
            "budget_stopped_early": r.budget_stopped_early,
            "error_message": r.error_message,
        }
        for r in runs
    ]


@router.get("/autonomous/weekly-report")
def get_weekly_report(db: Session = Depends(get_db)):
    runs = (
        db.query(AutonomousRun)
        .join(Batch)
        .filter(Batch.tenant_id == SYNEFI_TENANT_ID)
        .filter(AutonomousRun.status == "completed")
        .all()
    )
    return {
        "days_run": len(runs),
        "total_companies_discovered": sum(r.companies_discovered for r in runs),
        "total_companies_selected": sum(r.companies_selected for r in runs),
        "total_contacts_found": sum(r.contacts_found for r in runs),
        "total_contacts_pushed": sum(r.contacts_pushed for r in runs),
    }


@router.post("/autonomous/trigger-now")
def trigger_autonomous_now(db: Session = Depends(get_db)):
    """Manual override to run today's cycle immediately instead of waiting for the
    24h scheduler tick -- e.g. for testing before going live."""
    return run_daily_autonomous_cycle(db, tenant_id=SYNEFI_TENANT_ID)


# ---- Parameters (pipeline tuning knobs) ----

@router.get("/parameters")
def list_parameters(db: Session = Depends(get_db)):
    params = db.query(Parameter).filter(Parameter.tenant_id == SYNEFI_TENANT_ID).all()
    return [{"key": p.key, "value": p.value, "description": p.description} for p in params]


@router.post("/parameters")
def upsert_parameter(key: str, value: dict, description: str = "", db: Session = Depends(get_db)):
    param = (
        db.query(Parameter)
        .filter(Parameter.tenant_id == SYNEFI_TENANT_ID)
        .filter(Parameter.key == key)
        .first()
    )
    if param:
        param.value = value
        param.description = description or param.description
    else:
        param = Parameter(tenant_id=SYNEFI_TENANT_ID, key=key, value=value, description=description)
        db.add(param)
    db.commit()
    return {"key": key, "value": value}
