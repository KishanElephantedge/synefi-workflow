import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJobsToBeDone, formatApiError } from '../api.js'
import { IconAlertTriangle, IconTrendingUp, IconUsers, IconFlame, IconPhone, IconCheckCircle } from '../icons.jsx'

const PREVIEW_LIMIT = 3

// Jobs to Be Done redesign (2026-08-19), per the audit's own findings -- see that report for
// the full data/provenance trace. Structural changes from the pre-redesign version:
//   - "Worth engaging" is gone entirely: those were raw GtmSignal sensing records ("observed,
//     not yet interpreted"), never real human jobs -- the backend itself no longer returns this
//     category (see jobs_to_be_done.py), so the sidebar badge total dropped from 115 to
//     whatever the real job count is, with zero extra frontend logic needed.
//   - "Contacts to find" is now visually split into its two real sub-jobs (no contact found vs.
//     missing email) using the backend's own `breakdown` field -- never re-derived by string-
//     matching `description` client-side.
//   - Hot Leads and Contacts to Find both carry a "V1 Discovery" provenance tag: both are 100%
//     produced by V1's daily autonomous pipeline (Company.hot_lead / decision_maker_searched_at
//     are never touched by GTM-OS), confirmed in the audit -- the UI must not imply these are
//     GTM-OS-native output.
//   - A vertical, one-section-at-a-time priority flow (Deals -> Contacts -> Hot Leads -> Calls),
//     not Briefing's 2-column dashboard grid -- this is an action queue, not an overview.

function ProvenanceBadge() {
  return <span className="v2-system-badge v1_discovery">V1 Discovery</span>
}

function EmptyState({ title, subtitle }) {
  return (
    <div className="v2-jobs-empty">
      <IconCheckCircle width={18} height={18} />
      <div>
        <div className="v2-jobs-empty-title">{title}</div>
        {subtitle && <div className="v2-jobs-empty-subtitle">{subtitle}</div>}
      </div>
    </div>
  )
}

function ViewAllRow({ to, count }) {
  return (
    <div className="v2-mini-card-footer">
      <Link to={to}>View all {count} →</Link>
    </div>
  )
}

// Generic job row: title + one-line "why", real action_route from the backend, never invented.
function JobItem({ item, dotSeverity, subtitle }) {
  return (
    <Link to={item.action_route} className="v2-jobs-item">
      {dotSeverity && <div className={`v2-jobs-item-dot severity-${dotSeverity}`} />}
      <div className="v2-jobs-item-body">
        <div className="v2-jobs-item-title">{item.title}</div>
        <div className="v2-jobs-item-sub">{subtitle}</div>
      </div>
      <span className="v2-jobs-item-arrow">→</span>
    </Link>
  )
}

export default function JobsToBeDone() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    getJobsToBeDone().then(setData).catch(err => setError(formatApiError(err)))
  }, [])

  if (error) {
    return (
      <div className="v2-card">
        <div className="v2-state v2-state-error">
          <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
          <div>Couldn't load jobs to be done: {error}</div>
        </div>
      </div>
    )
  }

  if (data === null) {
    return (
      <div>
        <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 90, marginBottom: '1.5rem' }} />
        <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 260 }} />
      </div>
    )
  }

  const dealItems = data.items.filter(i => i.category === 'deal_needs_you')
  const hotLeadItems = data.items.filter(i => i.category === 'hot_leads_to_review')
  const deals = data.category_status.deal_needs_you
  const contacts = data.category_status.contacts_to_find
  const hotLeads = data.category_status.hot_leads_to_review
  const calls = data.category_status.calls_to_make

  return (
    <div>
      <div style={{ marginBottom: 'var(--v2-space-5)' }}>
        <h2 className="v2-page-title" style={{ fontSize: '1.3rem', marginBottom: 2 }}>Jobs to Be Done</h2>
        <div className="v2-exec-header-sub">Your highest-priority actions, top to bottom</div>
      </div>

      {/* Deals needing you -- always the strongest section visually, even at 0, since this is
          GTM-OS's own real Opportunity-execution output and the closest thing to revenue. */}
      <div className="v2-jobs-section">
        <div className="v2-jobs-section-head">
          <IconTrendingUp width={15} height={15} />
          <span>Deals needing you</span>
          <span className="v2-badge v2-badge-neutral">{deals.count}</span>
        </div>
        <div className="v2-jobs-card primary">
          {dealItems.length === 0 ? (
            <EmptyState title="You're clear for now" subtitle="No deals currently require your action." />
          ) : (
            <>
              {dealItems.slice(0, PREVIEW_LIMIT).map(item => (
                <JobItem key={`${item.source_type}-${item.source_id}`} item={item} subtitle={item.description} />
              ))}
              {dealItems.length > PREVIEW_LIMIT && <ViewAllRow to="/v2/pipeline" count={dealItems.length} />}
            </>
          )}
        </div>
      </div>

      {/* Contacts to find -- two distinct real jobs, never flattened into one generic bucket. */}
      <div className="v2-jobs-section">
        <div className="v2-jobs-section-head">
          <IconUsers width={15} height={15} />
          <span>Contacts to find</span>
          <span className="v2-badge v2-badge-neutral">{contacts.count}</span>
        </div>
        <div className="v2-jobs-provenance"><ProvenanceBadge /></div>
        <div className="v2-jobs-card">
          {contacts.count === 0 ? (
            <EmptyState title="Every account has a confirmed contact" />
          ) : (
            <>
              {contacts.breakdown.no_contact_found > 0 && (
                <Link to="/v2/accounts" className="v2-jobs-subrow">
                  <span className="v2-jobs-subrow-count">{contacts.breakdown.no_contact_found}</span>
                  <div className="v2-jobs-item-body">
                    <div className="v2-jobs-item-title">No decision-maker found</div>
                    <div className="v2-jobs-item-sub">Companies that still need contact research</div>
                  </div>
                  <span className="v2-jobs-item-arrow">→</span>
                </Link>
              )}
              {contacts.breakdown.missing_email > 0 && (
                <Link to="/v2/accounts" className="v2-jobs-subrow">
                  <span className="v2-jobs-subrow-count">{contacts.breakdown.missing_email}</span>
                  <div className="v2-jobs-item-body">
                    <div className="v2-jobs-item-title">Missing email</div>
                    <div className="v2-jobs-item-sub">A decision-maker was found, but no confirmed email is on file</div>
                  </div>
                  <span className="v2-jobs-item-arrow">→</span>
                </Link>
              )}
              <ViewAllRow to="/v2/accounts" count={contacts.count} />
            </>
          )}
        </div>
      </div>

      {/* Hot leads to review -- compact rows, not the old giant full-reasoning cards. */}
      <div className="v2-jobs-section">
        <div className="v2-jobs-section-head">
          <IconFlame width={15} height={15} />
          <span>Hot leads to review</span>
          <span className="v2-badge v2-badge-neutral">{hotLeads.count}</span>
        </div>
        <div className="v2-jobs-provenance"><ProvenanceBadge /></div>
        <div className="v2-jobs-card">
          {hotLeadItems.length === 0 ? (
            <EmptyState title="No hot leads flagged right now" />
          ) : (
            <>
              {hotLeadItems.slice(0, PREVIEW_LIMIT).map(item => (
                <JobItem
                  key={`${item.source_type}-${item.source_id}`}
                  item={item}
                  dotSeverity="warning"
                  // Concise, not the full raw semicolon-joined reasoning string -- the first
                  // real reason is enough to say WHY at a glance; the rest is one click away
                  // on the account page itself.
                  subtitle={(item.reason || '').split(';')[0].trim() || 'Hot lead'}
                />
              ))}
              {hotLeadItems.length > PREVIEW_LIMIT && <ViewAllRow to="/v2/accounts" count={hotLeadItems.length} />}
            </>
          )}
        </div>
      </div>

      {/* Calls to make -- kept as a real future category (per instruction), never showing raw
          backend/model language even when explicitly "unavailable" rather than just empty. */}
      <div className="v2-jobs-section">
        <div className="v2-jobs-section-head">
          <IconPhone width={15} height={15} />
          <span>Calls to make</span>
          <span className="v2-badge v2-badge-neutral">{calls.count}</span>
        </div>
        <div className="v2-jobs-card">
          <EmptyState
            title={calls.available ? 'No calls need your attention right now' : 'Not available yet'}
            subtitle={calls.available ? null : "This isn't tracking real call/reply activity yet."}
          />
        </div>
      </div>
    </div>
  )
}
