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

// V2 Frontend Phase (Message Workspace, inline in AccountDetail's Messages tab) -- backed by the
// new POST /gtm-os/messages/{id}/regenerate, itself a controlled re-invocation of the existing,
// unmodified generate_message_draft(). `contactId` is optional -- omit to regenerate for the
// same contact/decision-maker resolution as before, or pass one of getEligibleContacts()'s real
// ids to re-target. The backend itself re-validates eligibility -- this is not the only guard.
export function regenerateMessageDraft(messageDraftId, contactId) {
  return client.post(`/gtm-os/messages/${messageDraftId}/regenerate`, { contact_id: contactId ?? null }).then(res => res.data)
}

// Backed by the new GET /gtm-os/opportunities/{id}/eligible-contacts, a thin wrapper over the
// existing get_eligible_contacts() -- real, non-suppressed contacts only (Contact.excluded_from_push).
export function getEligibleContacts(opportunityId) {
  return client.get(`/gtm-os/opportunities/${opportunityId}/eligible-contacts`).then(res => res.data)
}

// 2026-08-25 -- real editing of AI-generated message content before approval. Backed by the new
// PATCH /gtm-os/messages/{id} (update_message_draft_content()). Either field may be omitted to
// leave it unchanged; the backend itself rejects editing an already-approved draft.
export function updateMessageDraft(messageDraftId, { subject, messageText } = {}) {
  return client.patch(`/gtm-os/messages/${messageDraftId}`, { subject: subject ?? null, message_text: messageText ?? null }).then(res => res.data)
}

// 2026-08-25 -- adds/corrects a contact's email directly from the Message Workspace (e.g. no
// email is on file yet, blocking an email draft). Backed by the new
// PATCH /gtm-os/contacts/{id}/email (update_contact_email()).
export function updateContactEmail(contactId, email) {
  return client.patch(`/gtm-os/contacts/${contactId}/email`, { email }).then(res => res.data)
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

// Campaign Intelligence -- backed by GET /gtm-os/campaign-intelligence: real, live per-campaign
// numbers pulled directly from SalesRobot's own API, plus a grounded LLM reasoning layer that
// compares campaigns and prioritizes toward revenue/conversions/meetings. Every claim the model
// makes is checked against the real numbers it was actually given -- a claim citing a campaign
// never provided is discarded server-side before it ever reaches this response.
export function getCampaignIntelligence() {
  return client.get('/gtm-os/campaign-intelligence').then(res => res.data)
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

// V2 Human-Provided Knowledge (architecture upgrade, Parts 6-9) -- backed by real, already-live
// GET/POST /gtm-os/knowledge routes (app/gtm_os/learning/human_knowledge.py). 2026-08-27, real
// bug fix: Knowledge.jsx already imported these 4 names, but they were never actually added to
// this file -- confirmed by grep (zero prior references) and by `npm run build` failing outright
// with "is not exported by api.js" the moment Knowledge.jsx got imported directly into
// Settings.jsx (this page was never bundled/build-checked before now, so the missing exports
// went uncaught). The backend has been real and complete this whole time.
export function getKnowledge(status) {
  return client.get('/gtm-os/knowledge', { params: status ? { status } : {} }).then(res => res.data.items)
}
export function submitKnowledge(text, createdBy) {
  return client.post('/gtm-os/knowledge', { text, created_by: createdBy }).then(res => res.data)
}
export function confirmKnowledge(knowledgeId, confirmedBy) {
  return client.post(`/gtm-os/knowledge/${knowledgeId}/confirm`, { confirmed_by: confirmedBy }).then(res => res.data)
}
export function dismissKnowledge(knowledgeId, confirmedBy) {
  return client.post(`/gtm-os/knowledge/${knowledgeId}/dismiss`, { confirmed_by: confirmedBy }).then(res => res.data)
}

// V2 Settings Performance tab -- real message-funnel/reply-outcome/strategy-type readout
// (app/gtm_os/learning/evaluation.py), the same computation governance.py's own Briefing
// snapshot already uses internally. No accuracy/hit-rate is computed anywhere in this readout.
export function getLearningReadout() {
  return client.get('/gtm-os/learning-readout').then(res => res.data)
}

// V2 Settings Connections tab -- real per-tenant credential presence (name/is_set/updated_at),
// same generic route V1's Settings page already uses; V2 simply hadn't been wired to it yet.
// Read-only here by design -- credential values are never returned or editable from V2.
export function getCredentials() {
  return client.get('/credentials').then(res => res.data)
}

// V2 Inbound page -- same backend routes V1's Inbound page already uses (app/google_analytics_client.py,
// app/google_search_console_client.py, app/website_visitor_tracking.py). No second implementation,
// just a V2-styled read of the same data.
export function getInboundAnalyticsOverview(params = {}) {
  return client.get('/inbound/analytics/overview', { params }).then(res => res.data)
}

export function getInboundAnalyticsTopPages(params = {}) {
  return client.get('/inbound/analytics/top-pages', { params }).then(res => res.data)
}

export function getInboundAnalyticsTrend(params = {}) {
  return client.get('/inbound/analytics/trend', { params }).then(res => res.data)
}

export function getInboundSearchConsoleTopQueries(params = {}) {
  return client.get('/inbound/search-console/top-queries', { params }).then(res => res.data)
}

export function getInboundSearchConsoleTopPages(params = {}) {
  return client.get('/inbound/search-console/top-pages', { params }).then(res => res.data)
}

export function getInboundVisitors(params = {}) {
  return client.get('/inbound/visitors', { params }).then(res => res.data)
}

// V2 Autonomous page -- thin wrappers over the existing, real, already-deployed control-plane
// routes (app/gtm_os/orchestration/control.py). No new backend routes -- these are the exact
// endpoints confirmed in the Phase-0-frontend-audit: GET/PUT /gtm-os/control (full config: state,
// limits, business_hours, discovery, retry, investigation, apify, outbound),
// GET /gtm-os/control/status (current state + latest GtmIntelligenceRun in one call), and
// POST /gtm-os/intelligence-runs/trigger (manual run, dry_run supported, blocked with a 409 if
// paused/stopped or another run is already in progress -- same guard as the scheduled tick).
export function getControlConfig() {
  return client.get('/gtm-os/control').then(res => res.data)
}
export function putControlConfig(config) {
  return client.put('/gtm-os/control', config).then(res => res.data)
}
export function getControlStatus() {
  return client.get('/gtm-os/control/status').then(res => res.data)
}
export function triggerIntelligenceRun(dryRun = false) {
  return client.post('/gtm-os/intelligence-runs/trigger', null, { params: { dry_run: dryRun } }).then(res => res.data)
}

// Fixed daily UTC time the sensing cycle fires at (changed from hourly to once-daily,
// 2026-08-23, to match V1's own daily autonomous cycle) -- app/gtm_os/orchestration/control.py's
// get_intelligence_schedule_utc/set_intelligence_schedule_utc.
export function getIntelligenceSchedule() {
  return client.get('/gtm-os/intelligence-schedule').then(res => res.data)
}
export function putIntelligenceSchedule(hour, minute) {
  return client.put('/gtm-os/intelligence-schedule', { hour, minute }).then(res => res.data)
}

// V2 Network page -- V1's Targets page ported onto the SAME real backend (app/phases/
// linkedin_monitor.py for the signal feed/watched profiles/keyword taxonomy/schedule, and
// app/phases/gtm_partner_classification.py for cross-industry partner matches). No new routes.
export function getNetworkSignals(limit = 50) {
  return client.get('/linkedin-monitor/signals', { params: { limit } }).then(res => res.data)
}
export function getNetworkProfiles() {
  return client.get('/linkedin-monitor/profiles').then(res => res.data)
}
export function addNetworkProfile({ name, company, linkedin_url }) {
  return client.post('/linkedin-monitor/profiles', null, { params: { name: name || undefined, company: company || undefined, linkedin_url } }).then(res => res.data)
}
export function removeNetworkProfile(profileId) {
  return client.delete(`/linkedin-monitor/profiles/${profileId}`).then(res => res.data)
}
export function toggleNetworkProfileActive(profileId, active) {
  return client.patch(`/linkedin-monitor/profiles/${profileId}`, null, { params: { active } }).then(res => res.data)
}
export function setNetworkProfileSlackId(profileId, slackUserId) {
  return client.patch(`/linkedin-monitor/profiles/${profileId}`, null, { params: { slack_user_id: slackUserId } }).then(res => res.data)
}
export function lookupNetworkProfileSlackId(profileId, email) {
  return client.post(`/linkedin-monitor/profiles/${profileId}/slack-lookup`, { email }).then(res => res.data)
}
export function getNetworkKeywords() {
  return client.get('/linkedin-monitor/keywords').then(res => res.data)
}
export function putNetworkKeywords(tiers) {
  return client.put('/linkedin-monitor/keywords', tiers).then(res => res.data)
}
export function getNetworkSchedule() {
  return client.get('/linkedin-monitor/schedule').then(res => res.data)
}
export function putNetworkSchedule(schedule) {
  return client.put('/linkedin-monitor/schedule', schedule).then(res => res.data)
}
export function runNetworkClassification(onlyUnclassified = true) {
  return client.post('/linkedin-monitor/classify', null, { params: { only_unclassified: onlyUnclassified } }).then(res => res.data)
}
export function getNetworkPartnerMatches() {
  return client.get('/linkedin-monitor/partner-matches').then(res => res.data)
}

// V2 Network > Recommended Companies -- V1's partner-referral matching pipeline, backed by
// app/phases/gtm_partner_matching.py (company matching, cap/schedule) and
// app/phases/gtm_partner_messaging.py (outreach drafting/send). No new routes.
export function runNetworkPartnerMatching({ onlyNewProfiles = true, profileId = null } = {}) {
  return client.post('/linkedin-monitor/match-companies', null, { params: { only_new_profiles: onlyNewProfiles, profile_id: profileId ?? undefined } }).then(res => res.data)
}
export function getNetworkMatchCap() {
  return client.get('/linkedin-monitor/match-cap').then(res => res.data)
}
export function putNetworkMatchCap(cap) {
  return client.put('/linkedin-monitor/match-cap', { cap }).then(res => res.data)
}
export function getNetworkMatchSchedule() {
  return client.get('/linkedin-monitor/match-schedule').then(res => res.data)
}
export function putNetworkMatchSchedule(schedule) {
  return client.put('/linkedin-monitor/match-schedule', schedule).then(res => res.data)
}
export function getNetworkRecommendations({ status = '', profileId = null } = {}) {
  return client.get('/linkedin-monitor/recommendations', { params: { status, profile_id: profileId ?? undefined } }).then(res => res.data)
}
export function updateNetworkRecommendation(recommendationId, status) {
  return client.patch(`/linkedin-monitor/recommendations/${recommendationId}`, { status }).then(res => res.data)
}
export function generateNetworkRecommendationMessage(profileId) {
  return client.post('/linkedin-monitor/recommendations/generate-message', null, { params: { profile_id: profileId } }).then(res => res.data)
}
export function getNetworkRecommendationMessages(profileId) {
  return client.get('/linkedin-monitor/messages', { params: { profile_id: profileId } }).then(res => res.data)
}
export function updateNetworkRecommendationMessage(messageId, status) {
  return client.patch(`/linkedin-monitor/messages/${messageId}`, { status }).then(res => res.data)
}
export function markNetworkRecommendationMessageSent(messageId, sendChannel) {
  return client.patch(`/linkedin-monitor/messages/${messageId}/mark-sent`, { send_channel: sendChannel }).then(res => res.data)
}

// V2 CRM -- direct HubSpot read/edit/delete (app/hubspot_client.py's CRM section), separate
// from V1's one-way push-only sync in app/phases/hubspot_sync.py. Every call hits HubSpot live.
export function listCrmCompanies({ limit = 25, after = null, search = null } = {}) {
  return client.get('/crm/companies', { params: { limit, after: after ?? undefined, search: search || undefined } }).then(res => res.data)
}
export function listCrmContacts({ limit = 25, after = null, search = null } = {}) {
  return client.get('/crm/contacts', { params: { limit, after: after ?? undefined, search: search || undefined } }).then(res => res.data)
}
export function getCrmCompany(companyId) {
  return client.get(`/crm/companies/${companyId}`).then(res => res.data)
}
export function getCrmContact(contactId) {
  return client.get(`/crm/contacts/${contactId}`).then(res => res.data)
}
export function updateCrmCompany(companyId, properties) {
  return client.patch(`/crm/companies/${companyId}`, properties).then(res => res.data)
}
export function updateCrmContact(contactId, properties) {
  return client.patch(`/crm/contacts/${contactId}`, properties).then(res => res.data)
}
export function deleteCrmCompany(companyId) {
  return client.delete(`/crm/companies/${companyId}`).then(res => res.data)
}
export function deleteCrmContact(contactId) {
  return client.delete(`/crm/contacts/${contactId}`).then(res => res.data)
}

// V2 Proposals -- the imported 2025 Sales Progress backlog + wherever future proposals land
// (see Proposal's own docstring in app/db/models.py). Manual browse/edit/remove only for now;
// no re-engagement/send logic wired yet.
export function listProposals({ page = 1, pageSize = 25, search = '', status = '' } = {}) {
  return client.get('/proposals', { params: { page, page_size: pageSize, search, status } }).then(res => res.data)
}
export function getProposal(proposalId) {
  return client.get(`/proposals/${proposalId}`).then(res => res.data)
}
export function updateProposal(proposalId, fields) {
  return client.patch(`/proposals/${proposalId}`, fields).then(res => res.data)
}
export function deleteProposal(proposalId) {
  return client.delete(`/proposals/${proposalId}`).then(res => res.data)
}

