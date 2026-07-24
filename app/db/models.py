from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Tenant(Base):
    """A business using this platform (e.g. Synefi, Elephant Edge). Every Batch, Credential,
    and Parameter belongs to exactly one tenant -- this is the sole isolation boundary between
    two businesses sharing the same database. No query anywhere should ever join across
    tenants; each tenant's data must be reachable only by filtering on its own tenant_id.

    Production shape: shared database (this schema), shared frontend codebase, but a
    SEPARATE backend codebase/deployment per tenant -- backend_url is how the frontend knows
    which backend to route a given tenant's API calls to. Redesigning one tenant's phase
    logic never touches another tenant's running backend."""

    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False, unique=True)
    backend_url = Column(String, nullable=True)  # e.g. "http://localhost:8001/api"
    created_at = Column(DateTime, default=datetime.utcnow)


class Batch(Base):
    """One execution run of the pipeline (a set of companies pushed through phase by phase)."""

    __tablename__ = "batches"

    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    current_phase = Column(String, default="signal_discovery")
    status = Column(String, default="in_progress")  # in_progress | complete

    tenant = relationship("Tenant")
    companies = relationship("Company", back_populates="batch", cascade="all, delete-orphan")


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    name = Column(String, nullable=False)
    domain = Column(String, nullable=True)
    industry = Column(String, nullable=True)
    employee_count = Column(Integer, nullable=True)
    location = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="companies")
    signals = relationship("Signal", back_populates="company", cascade="all, delete-orphan")
    score = relationship("Score", back_populates="company", uselist=False, cascade="all, delete-orphan")
    contacts = relationship("Contact", back_populates="company", cascade="all, delete-orphan")


class Signal(Base):
    """A single signal hit for a company (Phase 1 output)."""

    __tablename__ = "signals"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    category = Column(String, nullable=False)  # e.g. "job_posting", "tech_stack", etc.
    signal_type = Column(String, nullable=False)  # e.g. "AI Leadership job post"
    detail = Column(Text, nullable=True)  # raw evidence text
    fired_at = Column(DateTime, default=datetime.utcnow)  # for recency decay
    source = Column(String, nullable=True)  # which provider found it

    company = relationship("Company", back_populates="signals")


class Score(Base):
    """Phase 2 output: one score record per company, recomputed each cycle."""

    __tablename__ = "scores"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False, unique=True)
    signal_strength = Column(Float, default=0)
    icp_fit = Column(Float, default=0)
    financial_growth = Column(Float, default=0)
    compliance_complexity = Column(Float, default=0)
    greenfield_legacy = Column(Float, default=0)
    stacking_bonus = Column(Float, default=0)
    total_score = Column(Float, default=0)
    tier = Column(String, default="excluded")  # hot | warm | cool | excluded
    passed_industry_gate = Column(Boolean, default=False)
    computed_at = Column(DateTime, default=datetime.utcnow)
    breakdown = Column(JSON, nullable=True)  # full computation detail for transparency

    company = relationship("Company", back_populates="score")


class Contact(Base):
    """Phase 3 output: a decision-maker found for a company."""

    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    title = Column(String, nullable=True)
    linkedin_url = Column(String, nullable=True)
    thread_role = Column(String, nullable=True)  # champion | domain_compliance | economic_buyer
    matched_title_reasoning = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company", back_populates="contacts")
    enrichment = relationship("Enrichment", back_populates="contact", uselist=False, cascade="all, delete-orphan")
    campaign_pushes = relationship("CampaignPush", back_populates="contact", cascade="all, delete-orphan")


class Enrichment(Base):
    """Phase 4 output: contact map + generated outreach copy for a contact."""

    __tablename__ = "enrichments"

    id = Column(Integer, primary_key=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=False, unique=True)
    verified_email = Column(String, nullable=True)
    mobile_phone = Column(String, nullable=True)
    company_hq_address = Column(String, nullable=True)
    twitter_x = Column(String, nullable=True)
    blog_or_substack = Column(String, nullable=True)
    podcast_appearances = Column(JSON, nullable=True)
    upcoming_conference_slots = Column(JSON, nullable=True)
    channel_plan = Column(String, nullable=True)  # email-primary | linkedin-primary | multi-channel
    subject_line = Column(String, nullable=True)
    email_body = Column(Text, nullable=True)
    linkedin_connection_note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    contact = relationship("Contact", back_populates="enrichment")


class CampaignPush(Base):
    """Phase 5 (partial): record of pushing a contact into a HeyReach campaign."""

    __tablename__ = "campaign_pushes"

    id = Column(Integer, primary_key=True)
    contact_id = Column(Integer, ForeignKey("contacts.id"), nullable=False)
    heyreach_campaign_id = Column(String, nullable=True)
    status = Column(String, default="pending")  # pending | pushed | failed
    error_message = Column(Text, nullable=True)
    pushed_at = Column(DateTime, nullable=True)

    contact = relationship("Contact", back_populates="campaign_pushes")


class AutonomousRun(Base):
    """One day's autonomous cycle: Phase 1 -> 2 -> 3 -> 5, self-triggered.
    Also the record used to dedupe companies across days and to build the weekly report."""

    __tablename__ = "autonomous_runs"

    id = Column(Integer, primary_key=True)
    run_date = Column(DateTime, default=datetime.utcnow)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True)
    status = Column(String, default="running")  # running | completed | failed
    companies_discovered = Column(Integer, default=0)
    companies_selected = Column(Integer, default=0)  # the top-5 cap for the day
    contacts_found = Column(Integer, default=0)
    contacts_pushed = Column(Integer, default=0)
    credits_spent_usd = Column(Float, nullable=True)
    budget_stopped_early = Column(Boolean, default=False)
    error_message = Column(Text, nullable=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    batch = relationship("Batch")


class Credential(Base):
    """API keys/credentials managed via the dashboard Settings page. Scoped per tenant -- Synefi
    and Elephant Edge each have their own heyreach_api_key/heyreach_campaign_id row, never shared,
    even though they may both happen to use the same underlying HeyReach login."""

    __tablename__ = "credentials"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_credential_tenant_name"),)

    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    name = Column(String, nullable=False)  # e.g. "heyreach_api_key"
    value = Column(String, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tenant = relationship("Tenant")


class Parameter(Base):
    """Tunable pipeline parameters (scoring weights, title filters, thresholds) editable via
    dashboard. Scoped per tenant, same isolation rule as Credential above."""

    __tablename__ = "parameters"
    __table_args__ = (UniqueConstraint("tenant_id", "key", name="uq_parameter_tenant_key"),)

    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False)
    key = Column(String, nullable=False)
    value = Column(JSON, nullable=False)
    description = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tenant = relationship("Tenant")
