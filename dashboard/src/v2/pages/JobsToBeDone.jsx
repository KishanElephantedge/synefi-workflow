import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJobsToBeDone, formatApiError } from '../api.js'
import { IconAlertTriangle, IconTrendingUp, IconUsers, IconFlame, IconPhone, IconCheckCircle } from '../icons.jsx'

const PREVIEW_LIMIT = 3

// Jobs to Be Done, visual pass v3 (2026-08-19) -- lighter icon treatment (no filled chip, just
// a category-colored outline icon), more editorial category-label typography, and real routing:
// every "View all"/action link now sends the user into Accounts pre-filtered to the exact real
// work (?filter=hot_leads|no_contact|missing_email -- see api.js's listAccounts() and
// app/routes/api.py's `account_filter` param, which reuses jobs_to_be_done.py's own conditions
// verbatim), instead of dumping them on the full unfiltered account list. Data/category logic
// itself is unchanged from the prior pass.

function ProvenanceLabel() {
  return <span className="v2-job-provenance">V1 Discovery</span>
}

function ModuleHead({ title, count, provenance }) {
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
      <IconCheckCircle width={15} height={15} />
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

  return (
    <div>
      <div style={{ marginBottom: 'var(--v2-space-4)' }}>
        <h2 className="v2-page-title" style={{ fontSize: '1.2rem', marginBottom: 2 }}>Jobs to Be Done</h2>
        <div className="v2-exec-header-sub">Your highest-priority actions, top to bottom</div>
      </div>

      <div className="v2-card" style={{ padding: '0 var(--v2-space-5)' }}>

        {/* 1. Deal needs you -- the one GTM-OS-native category, strongest identity (accent)
            even at zero, since it's the real revenue-execution surface. */}
        <div className="v2-job-module">
          <IconTrendingUp width={18} height={18} className="v2-job-icon accent" />
          <div className="v2-job-body">
            <ModuleHead title="Deal needs you" count={deals.count} />
            {dealItems.length === 0 ? (
              <EmptyLine title="You're clear for now -- no deals currently require your action." />
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

        {/* 2. Contacts to find -- two real sub-jobs. Each is its own real link straight into
            Accounts filtered to exactly that work, not a single generic button. */}
        <div className="v2-job-module">
          <IconUsers width={18} height={18} className="v2-job-icon danger" />
          <div className="v2-job-body">
            <ModuleHead title="Contacts to find" count={contacts.count} provenance />
            {contacts.count === 0 ? (
              <EmptyLine title="Every account has a confirmed contact." />
            ) : (
              <>
                <p className="v2-job-explanation">Two research jobs, from the discovery pipeline's contact search.</p>
                <div className="v2-job-examples">
                  {contacts.breakdown.no_contact_found > 0 && (
                    <Link to="/v2/accounts?filter=no_contact" className="v2-job-example linked">
                      <span className="v2-job-example-count">{contacts.breakdown.no_contact_found}</span>
                      <span className="v2-job-example-body">
                        <span className="v2-job-example-name">No decision-maker found</span>
                        <span className="v2-job-example-reason">Companies that still need contact research</span>
                      </span>
                      <span className="v2-job-example-arrow">↗</span>
                    </Link>
                  )}
                  {contacts.breakdown.missing_email > 0 && (
                    <Link to="/v2/accounts?filter=missing_email" className="v2-job-example linked">
                      <span className="v2-job-example-count">{contacts.breakdown.missing_email}</span>
                      <span className="v2-job-example-body">
                        <span className="v2-job-example-name">Missing email</span>
                        <span className="v2-job-example-reason">Decision-maker found, but no confirmed email on file</span>
                      </span>
                      <span className="v2-job-example-arrow">↗</span>
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 3. Hot leads to review -- V1 discovery-pipeline heuristics, compact, one concise
            reason per lead (not the old full semicolon-joined reasoning string). */}
        <div className="v2-job-module">
          <IconFlame width={18} height={18} className="v2-job-icon warning" />
          <div className="v2-job-body">
            <ModuleHead title="Hot leads to review" count={hotLeads.count} provenance />
            {hotLeadItems.length === 0 ? (
              <EmptyLine title="No hot leads flagged right now." />
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
                <Link to="/v2/accounts?filter=hot_leads" className="v2-job-cta">
                  Review all {hotLeads.count} ↗
                </Link>
              </>
            )}
          </div>
        </div>

        {/* 4. Calls to make -- kept as a real future category, compact disabled state, no
            backend/model terminology even when explicitly unavailable rather than just empty. */}
        <div className="v2-job-module">
          <IconPhone width={18} height={18} className="v2-job-icon info" />
          <div className="v2-job-body">
            <ModuleHead title="Calls to make" count={calls.count} />
            <EmptyLine title={calls.available ? 'No calls need your attention right now.' : "Not available yet -- this isn't tracking real call/reply activity yet."} />
          </div>
        </div>

      </div>
    </div>
  )
}
