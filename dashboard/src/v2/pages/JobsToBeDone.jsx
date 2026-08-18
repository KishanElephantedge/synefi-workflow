import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJobsToBeDone, formatApiError } from '../api.js'
import { IconAlertTriangle, IconTrendingUp, IconUsers, IconFlame, IconPhone, IconCheckCircle } from '../icons.jsx'

const PREVIEW_LIMIT = 3

// Jobs to Be Done, visual pass v2 (2026-08-19) -- per the lead's own reference direction: compact
// ACTION MODULES (icon chip -> title + right-aligned count -> 1-line explanation -> 2-3 examples
// -> ONE category CTA), not the large mostly-empty cards the first redesign produced. Data/
// category decisions from the prior pass are unchanged -- see jobs_to_be_done.py: Worth Engaging
// stays removed, Contacts to Find stays split via the backend's own `breakdown` field, V1
// provenance stays on Contacts/Hot Leads only. This pass is presentation-only.

function ProvenanceLabel() {
  return <span className="v2-job-provenance">V1 Discovery</span>
}

function ModuleHead({ icon, accent, title, count, provenance }) {
  return (
    <div className="v2-job-head">
      <div className="v2-job-title-row">
        <span className="v2-job-title">{title}</span>
        {provenance && <ProvenanceLabel />}
      </div>
      <span className="v2-job-count">{count}</span>
    </div>
  )
}

function EmptyLine({ title }) {
  return (
    <div className="v2-job-empty">
      <IconCheckCircle width={16} height={16} />
      <span>{title}</span>
    </div>
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
        <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 70, marginBottom: '1rem' }} />
        <div className="v2-skeleton-row" style={{ borderRadius: 'var(--v2-radius-lg)', height: 320 }} />
      </div>
    )
  }

  const dealItems = data.items.filter(i => i.category === 'deal_needs_you')
  const hotLeadItems = data.items.filter(i => i.category === 'hot_leads_to_review')
  const deals = data.category_status.deal_needs_you
  const contacts = data.category_status.contacts_to_find
  const hotLeads = data.category_status.hot_leads_to_review
  const calls = data.category_status.calls_to_make

  const bothContactTypes = contacts.breakdown.no_contact_found > 0 && contacts.breakdown.missing_email > 0

  return (
    <div>
      <div style={{ marginBottom: 'var(--v2-space-4)' }}>
        <h2 className="v2-page-title" style={{ fontSize: '1.2rem', marginBottom: 2 }}>Jobs to Be Done</h2>
        <div className="v2-exec-header-sub">Your highest-priority actions, top to bottom</div>
      </div>

      <div className="v2-card" style={{ padding: '0 var(--v2-space-5)' }}>

        {/* 1. Deal needs you -- the one GTM-OS-native category, always the strongest identity
            (purple/accent) even at zero, since it's the real revenue-execution surface. */}
        <div className="v2-job-module">
          <div className={`v2-job-icon-chip accent`}>
            <IconTrendingUp width={19} height={19} />
          </div>
          <div className="v2-job-body">
            <ModuleHead title="Deal needs you" count={deals.count} />
            {dealItems.length === 0 ? (
              <>
                <p className="v2-job-explanation" style={{ marginBottom: 0 }}>You're clear for now -- no deals currently require your action.</p>
              </>
            ) : (
              <>
                <p className="v2-job-explanation">Opportunities blocked on a human step.</p>
                <div className="v2-job-examples">
                  {dealItems.slice(0, PREVIEW_LIMIT).map(item => (
                    <div className="v2-job-example" key={`${item.source_type}-${item.source_id}`}>
                      <span className="v2-job-example-name">{item.title}</span>
                      <span className="v2-job-example-sep">—</span>
                      <span className="v2-job-example-reason">{item.description}</span>
                    </div>
                  ))}
                </div>
                <Link to={dealItems.length === 1 ? dealItems[0].action_route : '/v2/pipeline'} className="v2-job-cta">
                  {dealItems.length === 1 ? 'Open deal strategy' : 'Review deals'} ↗
                </Link>
              </>
            )}
          </div>
        </div>

        {/* 2. Contacts to find -- two real sub-jobs, both from V1's decision-maker search. */}
        <div className="v2-job-module">
          <div className="v2-job-icon-chip danger">
            <IconUsers width={19} height={19} />
          </div>
          <div className="v2-job-body">
            <ModuleHead title="Contacts to find" count={contacts.count} provenance />
            {contacts.count === 0 ? (
              <p className="v2-job-explanation" style={{ marginBottom: 0 }}>Every account has a confirmed contact.</p>
            ) : (
              <>
                <p className="v2-job-explanation">Two research jobs, from the discovery pipeline's contact search.</p>
                <div className="v2-job-examples">
                  {contacts.breakdown.no_contact_found > 0 && (
                    <div className="v2-job-example">
                      <span className="v2-job-example-count">{contacts.breakdown.no_contact_found}</span>
                      <span className="v2-job-example-name">No decision-maker found</span>
                      <span className="v2-job-example-sep">—</span>
                      <span className="v2-job-example-reason">companies that still need contact research</span>
                    </div>
                  )}
                  {contacts.breakdown.missing_email > 0 && (
                    <div className="v2-job-example">
                      <span className="v2-job-example-count">{contacts.breakdown.missing_email}</span>
                      <span className="v2-job-example-name">Missing email</span>
                      <span className="v2-job-example-sep">—</span>
                      <span className="v2-job-example-reason">a decision-maker was found, but no confirmed email is on file</span>
                    </div>
                  )}
                </div>
                <Link to="/v2/accounts" className="v2-job-cta">
                  {bothContactTypes ? 'Research both' : 'Research now'} ↗
                </Link>
              </>
            )}
          </div>
        </div>

        {/* 3. Hot leads to review -- V1 discovery-pipeline heuristics, compact, one concise
            reason per lead (not the old full semicolon-joined reasoning string). */}
        <div className="v2-job-module">
          <div className="v2-job-icon-chip warning">
            <IconFlame width={19} height={19} />
          </div>
          <div className="v2-job-body">
            <ModuleHead title="Hot leads to review" count={hotLeads.count} provenance />
            {hotLeadItems.length === 0 ? (
              <p className="v2-job-explanation" style={{ marginBottom: 0 }}>No hot leads flagged right now.</p>
            ) : (
              <>
                <p className="v2-job-explanation">Flagged by discovery-pipeline signals -- worth a look.</p>
                <div className="v2-job-examples">
                  {hotLeadItems.slice(0, PREVIEW_LIMIT).map(item => (
                    <div className="v2-job-example" key={`${item.source_type}-${item.source_id}`}>
                      <span className="v2-job-example-name">{item.title}</span>
                      <span className="v2-job-example-sep">—</span>
                      <span className="v2-job-example-reason">{(item.reason || '').split(';')[0].trim() || 'Hot lead'}</span>
                    </div>
                  ))}
                </div>
                <Link to="/v2/accounts" className="v2-job-cta">
                  Review {hotLeadItems.length === hotLeads.count ? `all ${hotLeads.count}` : 'leads'} ↗
                </Link>
              </>
            )}
          </div>
        </div>

        {/* 4. Calls to make -- kept as a real future category, compact disabled state, no
            backend/model terminology even when explicitly unavailable rather than just empty. */}
        <div className="v2-job-module">
          <div className="v2-job-icon-chip info">
            <IconPhone width={19} height={19} />
          </div>
          <div className="v2-job-body">
            <ModuleHead title="Calls to make" count={calls.count} />
            <EmptyLine title={calls.available ? 'No calls need your attention right now.' : "Not available yet -- this isn't tracking real call/reply activity yet."} />
          </div>
        </div>

      </div>
    </div>
  )
}
