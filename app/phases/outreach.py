from datetime import datetime

from sqlalchemy.orm import Session

from app.db.models import CampaignPush, Company, Contact, Parameter
from app.heyreach_client import HeyReachError, add_leads_to_campaign, get_campaign


def _get_campaign_id(db: Session, tenant_id: int) -> int:
    param = (
        db.query(Parameter)
        .filter(Parameter.tenant_id == tenant_id)
        .filter(Parameter.key == "heyreach_campaign_id")
        .first()
    )
    if not param or not param.value:
        raise HeyReachError("heyreach_campaign_id parameter is not set for this tenant")
    return int(param.value.get("campaign_id") if isinstance(param.value, dict) else param.value)


def _get_sender_account_id(campaign_id: int, db: Session, tenant_id: int) -> int:
    """Same account HeyReach used for the manual campaign -- take the first sender
    account already configured on the target campaign, don't pick a new one."""
    campaign = get_campaign(campaign_id, db, tenant_id)
    account_ids = campaign.get("campaignAccountIds") or campaign.get("accountIds") or []
    if not account_ids:
        raise HeyReachError(f"Campaign {campaign_id} has no sender LinkedIn accounts configured")
    return account_ids[0]


def run_outreach_push(batch_id: int, db: Session, tenant_id: int) -> dict:
    """Phase 5 (simplified v1): push Phase 3 contacts with a known LinkedIn URL into the
    existing HeyReach campaign, exactly like the manual run -- single shared campaign
    message already configured in HeyReach, no per-contact AI copy, no email/multi-channel.
    Skips contacts already pushed successfully (no duplicate sends). Campaign ID and API key
    are both looked up scoped to tenant_id, so each tenant pushes into its own campaign even
    if two tenants happen to share the same underlying HeyReach login."""
    campaign_id = _get_campaign_id(db, tenant_id)
    sender_account_id = _get_sender_account_id(campaign_id, db, tenant_id)

    all_contacts = db.query(Contact).join(Company).filter(Company.batch_id == batch_id).all()
    contacts = [c for c in all_contacts if c.linkedin_url]
    skipped_no_linkedin = len(all_contacts) - len(contacts)

    already_pushed_ids = {
        p.contact_id
        for p in db.query(CampaignPush)
        .filter(CampaignPush.contact_id.in_([c.id for c in contacts]))
        .filter(CampaignPush.status == "pushed")
        .all()
    }

    pushed = 0
    failed = 0
    skipped_already_pushed = 0

    for contact in contacts:
        if contact.id in already_pushed_ids:
            skipped_already_pushed += 1
            continue

        lead = {"profileUrl": contact.linkedin_url}
        if contact.first_name:
            lead["firstName"] = contact.first_name
        if contact.last_name:
            lead["lastName"] = contact.last_name
        if contact.title:
            lead["position"] = contact.title
        if contact.company.name:
            lead["companyName"] = contact.company.name

        account_lead_pairs = [{"linkedInAccountId": sender_account_id, "lead": lead}]

        try:
            add_leads_to_campaign(campaign_id, account_lead_pairs, db, tenant_id)
            status, error_message = "pushed", None
            pushed += 1
        except HeyReachError as e:
            status, error_message = "failed", str(e)
            failed += 1

        db.add(CampaignPush(
            contact_id=contact.id,
            heyreach_campaign_id=str(campaign_id),
            status=status,
            error_message=error_message,
            pushed_at=datetime.utcnow() if status == "pushed" else None,
        ))
    db.commit()

    return {
        "contacts_checked": len(contacts),
        "pushed": pushed,
        "failed": failed,
        "skipped_no_linkedin": skipped_no_linkedin,
        "skipped_already_pushed": skipped_already_pushed,
    }
