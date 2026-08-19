// Thin V2 data-fetching helpers over the SAME existing client (src/api/client.js) V1 already
// uses -- no second API abstraction, no duplicated auth/tenant-scoping logic. `client` already
// prefixes tenant-scoped calls with `/api/{activeTenantSlug}/...` via its own interceptor (see
// setActiveTenant in V2App.jsx).
import client from '../api/client'

// Normalizes an API error into a plain, human-readable string. Handles FastAPI's two real
// response shapes: a plain string `detail` (every V2 route in this app), and the list-of-objects
// `detail` FastAPI itself generates for a 422 validation error (never seen from a route we wrote
// by hand, but a real possibility on malformed input) -- without this, that list renders as
// "[object Object]" or a raw dumped JSON blob instead of readable text. Never fabricates a
// message; falls back to the raw Error's own message when there's nothing else to show.
export function formatApiError(err) {
  const detail = err?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail)) {
    const msgs = detail.map(d => (typeof d === 'string' ? d : d?.msg)).filter(Boolean)
    if (msgs.length) return msgs.join('; ')
  }
  if (detail && typeof detail === 'object' && typeof detail.msg === 'string') return detail.msg
  return err?.message || 'Something went wrong.'
}

// `accountFilter` -- "hot_leads" | "no_contact" | "missing_email" (V2 Jobs-to-Be-Done wiring,
// 2026-08-19). Maps straight to the backend's `account_filter` param (app/routes/api.py),
// itself reusing the exact same real conditions jobs_to_be_done.py computes its counts from --
// see that route's own docstring for why this exists (a Jobs "View all 99" used to link to the
// fully unfiltered 706-company list).
export function listAccounts({ page = 1, pageSize = 25, search = '', accountFilter = '' } = {}) {
  return client.get('/companies', { params: { page, page_size: pageSize, search, account_filter: accountFilter } }).then(res => res.data)
}

// Backed by the new, purely-additive GET /gtm-os/accounts/{company_id}/brief route (Phase 2),
// which itself only wraps the existing, unmodified build_account_brief() (Batch 12). No frontend
// re-derivation of ICP/offering/strategy/readiness logic happens anywhere in this file.
export function getAccountBrief(companyId) {
  return client.get(`/gtm-os/accounts/${companyId}/brief`).then(res => res.data)
}

// Phase 3 -- backed by GET /gtm-os/pipeline, itself a thin wrapper over list_pipeline_items()
// (reuses get_next_execution_action()/recommend_gtm_motion() per item, unmodified).
export function getPipeline({ page = 1, pageSize = 25 } = {}) {
  return client.get('/gtm-os/pipeline', { params: { page, page_size: pageSize } }).then(res => res.data)
}

// Real, persisted hourly-sweep run history -- used by Pipeline's empty state to show honest
// system status (last run time/status, funnel counts) instead of a bare "nothing here" message.
// Never used to invent a next-run ETA or a qualification reason the API doesn't provide.
export function getIntelligenceRuns(limit = 1) {
  return client.get('/gtm-os/intelligence-runs', { params: { limit } }).then(res => res.data)
}

// Phase 3 -- backed by GET /gtm-os/accounts/{company_id}/messages, a read-only wrapper over
// list_messages_for_company() (Batch 7's MessageDraft). Never generates or approves anything.
export function getAccountMessages(companyId) {
  return client.get(`/gtm-os/accounts/${companyId}/messages`).then(res => res.data)
}

// Phase 3 -- backed by GET /gtm-os/accounts/summary, a bulk-query reproduction of Batch 12's
// account_status ladder (see summarize_account_states()'s own docstring for why this exists
// separately from calling build_account_brief() once per company).
export function getAccountsSummary() {
  return client.get('/gtm-os/accounts/summary').then(res => res.data)
}

// Phase 4 -- backed by GET /gtm-os/market-intelligence, a thin wrapper over
// get_market_intelligence_overview() (reuses evaluate_topic_trend() per configured topic,
// unmodified, plus the Batch 11 account-bridge count for that same topic).
export function getMarketIntelligence() {
  return client.get('/gtm-os/market-intelligence').then(res => res.data)
}

// Phase 4 -- backed by GET /gtm-os/demand-grid, a thin wrapper over get_demand_grid() (ICP x
// Offering configuration facts, reused unmodified from Batch 8/9's own config readers).
export function getDemandGrid() {
  return client.get('/gtm-os/demand-grid').then(res => res.data)
}

// Phase 4 -- backed by GET /gtm-os/demand-grid/{icp_id}/companies, the real ICPMatch rows
// behind one Demand Grid row's matched_account_count.
export function getDemandGridCompanies(icpId) {
  return client.get(`/gtm-os/demand-grid/${icpId}/companies`).then(res => res.data)
}

// Phase 5 -- backed by GET /gtm-os/icps-offerings, a combined read over get_icp_config()/
// get_offering_config()/get_gtm_motion_config()/get_demand_grid() (all unmodified).
export function getIcpsOfferings() {
  return client.get('/gtm-os/icps-offerings').then(res => res.data)
}

// Phase 5 writes -- each reuses the existing set_icp_config()/set_offering_config()/
// set_gtm_motion_config() validation verbatim (see api.py route docstrings for the
// authorization note). Each returns the freshly-read combined overview on success.
export function putIcps(icps) {
  return client.put('/gtm-os/icps', icps).then(res => res.data)
}
export function putOfferings(offerings) {
  return client.put('/gtm-os/offerings', offerings).then(res => res.data)
}
export function putGtmMotions(motions) {
  return client.put('/gtm-os/gtm-motions', motions).then(res => res.data)
}

// Phase 6 -- backed by GET /gtm-os/briefing-governance. V2 UI audit (2026-08-18): now reads a
// cached GovernanceSnapshot (computed hourly) instead of recomputing evaluate_gtm_governance()
// live on every request -- same real fields, plus `computed_at` for staleness display.
export function getBriefingGovernance() {
  return client.get('/gtm-os/briefing-governance').then(res => res.data)
}

// Manual "Refresh now" -- forces a fresh evaluate_gtm_governance() computation right now (can
// take a couple of minutes; the caller shows a loading state while this is in flight).
export function refreshBriefingGovernance() {
  return client.post('/gtm-os/briefing-governance/refresh').then(res => res.data)
}

// Phase 7 -- backed by GET /gtm-os/pipeline/{opportunity_id}, the single-opportunity
// counterpart to getPipeline() above (same _build_pipeline_item() on the backend).
export function getPipelineItem(opportunityId) {
  return client.get(`/gtm-os/pipeline/${opportunityId}`).then(res => res.data)
}

// Phase 7 -- the ONLY write this phase adds: the human approval boundary. `action` is one of
// "approve" | "reject" | "request_changes". `reviewedBy` is the real logged-in user's email
// (from useTenant()'s user object) -- this backend has no independent identity channel of its
// own (see api.py's route docstring), so the caller must supply it.
export function reviewMessageDraft(messageDraftId, action, reviewedBy, note) {
  return client.post(`/gtm-os/messages/${messageDraftId}/review`, { action, reviewed_by: reviewedBy, note }).then(res => res.data)
}

// Phase 9 -- backed by the pre-existing GET/PUT /gtm-os/business-context (app/gtm_os/context/
// business_context.py), the only gtm_os route that predates Phase 2. PUT has no field-level
// validation of its own (set_business_context() stores whatever dict it's given), so
// Settings.jsx always sends back the full fetched context object with only the edited tab's
// sub-fields overridden -- never a partial payload -- to avoid the frontend itself being the
// thing that drops data an unvalidated backend won't catch.
export function getBusinessContext() {
  return client.get('/gtm-os/business-context').then(res => res.data)
}
export function putBusinessContext(context) {
  return client.put('/gtm-os/business-context', context).then(res => res.data)
}

// V2 Meetings -- backed by the SAME existing GET /calendar-bookings route V1's Meetings.jsx
// already uses (app/routes/api.py, CalendarBooking model). Real feature, not a new one: a
// periodic sync pulls confirmed/cancelled calls booked through the lead's Google Calendar
// Appointment Schedule. No V2-specific route was added -- same params (page/page_size/search),
// same response shape (page, page_size, total, total_pages, bookings[]).
// Efficiency -- backed by GET/PUT /gtm-os/efficiency-benchmarks (Parameter-backed config, same
// pattern as business-context) and GET /gtm-os/efficiency (pure read-only aggregation over real
// recorded activity + AutonomousRun timing). See app/gtm_os/efficiency/ on the backend.
export function getEfficiencyBenchmarks() {
  return client.get('/gtm-os/efficiency-benchmarks').then(res => res.data.benchmarks)
}
export function putEfficiencyBenchmarks(benchmarks) {
  return client.put('/gtm-os/efficiency-benchmarks', benchmarks).then(res => res.data.benchmarks)
}
export function getEfficiency(month) {
  return client.get('/gtm-os/efficiency', { params: month ? { month } : {} }).then(res => res.data)
}

// Jobs to Be Done -- backed by GET /gtm-os/jobs-to-be-done, a pure read-only composition of
// existing readers (execution_readiness.py, hot_leads.py's Company.hot_lead, decision-maker
// research state, GtmSignal/InterpretedSignal). Nothing here is persisted or generated by an LLM.
export function getJobsToBeDone() {
  return client.get('/gtm-os/jobs-to-be-done').then(res => res.data)
}

export function getMeetings({ page = 1, pageSize = 25, search = '' } = {}) {
  return client.get('/calendar-bookings', { params: { page, page_size: pageSize, search } }).then(res => res.data)
}

// Meeting Outcomes -- backed by the new PATCH /calendar-bookings/{id}/outcome (thin wrapper over
// record_meeting_outcome(), app/gtm_os/revenue/revenue_pace.py). `status` is "won" | "lost" | null
// (null resets to pending). `recordedBy` is the real logged-in user's email, same pattern as
// Phase 7's reviewMessageDraft() -- this backend has no independent identity channel of its own.
export function patchMeetingOutcome(bookingId, { status, companyId, offeringName, amountUsd, reason, notes, recordedBy, opportunityId }) {
  return client.patch(`/calendar-bookings/${bookingId}/outcome`, {
    status, company_id: companyId, offering_name: offeringName, amount_usd: amountUsd, reason, notes, recorded_by: recordedBy, opportunity_id: opportunityId,
  }).then(res => res.data)
}

// Revenue Pace -- backed by the new GET /gtm-os/revenue-pace, a thin wrapper over
// get_revenue_pace() (pure read-only aggregation over recorded meeting outcomes +
// business_context's revenue_goal). Returns target_configured=false rather than a guess when no
// numeric target is set.
export function getRevenuePace(month) {
  return client.get('/gtm-os/revenue-pace', { params: month ? { month } : {} }).then(res => res.data)
}

// Revenue Pace Diagnosis -- backed by GET /gtm-os/revenue-pace/diagnosis, a pure read-only
// composition over Revenue Pace + Jobs to Be Done + Overrides & Evals (confirmed patterns only).
// The base Revenue Pace numbers above remain the source of truth; this only adds context.
export function getRevenuePaceDiagnosis(month) {
  return client.get('/gtm-os/revenue-pace/diagnosis', { params: month ? { month } : {} }).then(res => res.data)
}

// Overrides & Evals -- backed by GET /gtm-os/overrides-evals (pure read-only aggregation over
// MessageDraft's own review lifecycle + CalendarBooking's own outcome fields, no second review/
// outcome engine) and POST /gtm-os/patterns/{category}/confirm|dismiss (the only writes -- a
// human decision, never automatic). Category is the key, not a numeric id, since a candidate
// pattern isn't a persisted row until a human acts on it -- see the backend module's docstring.
export function getOverridesEvals(month) {
  return client.get('/gtm-os/overrides-evals', { params: month ? { month } : {} }).then(res => res.data)
}
export function confirmPattern(category, confirmedBy) {
  return client.post(`/gtm-os/patterns/${encodeURIComponent(category)}/confirm`, { confirmed_by: confirmedBy }).then(res => res.data)
}
export function dismissPattern(category, confirmedBy) {
  return client.post(`/gtm-os/patterns/${encodeURIComponent(category)}/dismiss`, { confirmed_by: confirmedBy }).then(res => res.data)
}

