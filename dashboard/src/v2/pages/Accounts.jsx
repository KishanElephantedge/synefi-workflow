import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listAccounts, getAccountsSummary, formatApiError } from '../api.js'
import { formatRecency } from '../format.js'
import { IconAlertTriangle, IconChevronLeft, IconChevronRight, IconX } from '../icons.jsx'

// Real, plain-English label for each ?filter= value Jobs to Be Done can link here with -- see
// api.js's listAccounts() and app/routes/api.py's `account_filter` docstring for the exact
// conditions each one reuses from jobs_to_be_done.py.
const FILTER_LABEL = {
  hot_leads: 'Hot leads',
  no_contact: 'No decision-maker found',
  missing_email: 'Missing email',
}

const PAGE_SIZE = 25

// Real ACCOUNT_STATES_ORDER labels (Batch 12), weakest -> strongest -- NOT the reference
// deck's "Active/Needs you/Dormant/Goal hit rate" vocabulary. That vocabulary describes a
// persistent-agent-per-account concept (days-active, dormancy) the backend doesn't implement;
// showing it here would mean inventing an account status Part 9/15 explicitly forbids. This
// shows the real, already-defined 6-state distribution instead -- see the Phase 3 report's
// "screenshot ambiguity" note.
const SUMMARY_TILES = [
  ['insufficient_context', 'Insufficient context'],
  ['identified', 'Identified'],
  ['icp_matched', 'ICP matched'],
  ['opportunity_identified', 'Opportunity identified'],
  ['strategy_ready', 'Strategy ready'],
  ['sales_ready', 'Sales ready'],
]

const STATE_LABEL = Object.fromEntries(SUMMARY_TILES)

// Progressive visual weight, weakest -> strongest -- same six real states, no new state
// invented, no rainbow of unrelated colors. Every state is now a real chip (never plain
// uppercase text) -- intensity escalates from a neutral gray chip through a subtle blue
// ("identified"), into the brand accent ("icp_matched"/"opportunity_identified"), then
// warning/success for the two states that mean real sales readiness -- the same hues already
// established for badges elsewhere in this app (AccountDetail.jsx's STATUS_BADGE), just with
// increasing fill intensity rather than six unrelated colors.
const STATE_TIER = {
  insufficient_context: 'neutral',
  identified: 'info-soft',
  icp_matched: 'accent-soft',
  opportunity_identified: 'accent-solid',
  strategy_ready: 'warning-solid',
  sales_ready: 'success-solid',
}

// "Actionable" tier gates whether a row shows the colored left accent + intelligence stats --
// the two weakest states have no real GTM-OS progress yet (see list_account_states()), so they
// stay visually quiet even though they now get a real (muted) chip like every other state.
const QUIET_STATES = new Set(['insufficient_context', 'identified'])

function StatusMark({ status }) {
  const tier = STATE_TIER[status] || 'neutral'
  const label = STATE_LABEL[status] || status
  return <span className={`v2-account-status v2-status-pill tone-${tier}`}>{label}</span>
}

// Renders the real six-state funnel as a left-to-right progression (weakest -> strongest).
// Non-zero stages get real typographic weight; zero stages recede -- same real numbers, never a
// re-derived count, just unequal visual treatment so 2 real ICP matches don't read as equal in
// importance to 593 accounts with no evidence yet.
function SummaryStrip({ summary }) {
  if (!summary) return null
  return (
    <div className="v2-account-funnel">
      <div className="v2-account-funnel-total">
        <div className="v2-account-funnel-total-value">{summary.total_accounts}</div>
        <div className="v2-stat-label">Total accounts</div>
      </div>
      <div className="v2-account-funnel-track">
        {SUMMARY_TILES.map(([key, label], i) => {
          const count = summary.account_states[key] ?? 0
          return (
            <div className={`v2-account-funnel-step${count > 0 ? ' has-count' : ''}`} key={key}>
              <div className="v2-account-funnel-chip">
                <span className="v2-account-funnel-step-value">{count}</span>
                <span className="v2-account-funnel-step-label">{label}</span>
              </div>
              {i < SUMMARY_TILES.length - 1 && <IconChevronRight width={11} height={11} className="v2-account-funnel-arrow" />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Formats a real employee_count/revenue range without inventing precision the data doesn't
// have -- revenue is a derived (lower, upper) band, not a point figure, so it renders as a
// range or not at all rather than picking one number.
function formatSize(company) {
  const parts = []
  if (company.employee_count) parts.push(`${company.employee_count} emp`)
  if (company.estimated_revenue_lower_usd) {
    const fmt = (n) => n >= 1_000_000 ? `$${Math.round(n / 1_000_000)}M` : `$${Math.round(n / 1000)}K`
    parts.push(
      company.estimated_revenue_higher_usd && company.estimated_revenue_higher_usd !== company.estimated_revenue_lower_usd
        ? `${fmt(company.estimated_revenue_lower_usd)}-${fmt(company.estimated_revenue_higher_usd)}`
        : fmt(company.estimated_revenue_lower_usd)
    )
  }
  return parts.join(' · ')
}

// CRM-style table row -- one line per account, every real field the card view buried behind a
// click (employee/revenue size, contact count, outreach status) now visible without navigating
// away. "Open" stays a real link to the same detail page (Account Agent), per explicit
// instruction to keep that click-through for the deep-dive view.
function AccountRow({ company }) {
  const accountStatus = company.account_status || 'insufficient_context'
  const isQuiet = QUIET_STATES.has(accountStatus)
  const hasEvidence = !isQuiet && ((company.signal_count > 0) || (company.opportunity_count > 0))
  const added = formatRecency(company.created_at)
  const size = formatSize(company)

  return (
    <tr className={`v2-account-state-${accountStatus}`}>
      <td>
        <div className="v2-account-name">{company.name}</div>
        <div className="v2-table-muted">{[company.domain, company.industry].filter(Boolean).join(' · ') || '—'}</div>
      </td>
      <td className={size ? '' : 'v2-table-muted'}>{size || '—'}</td>
      <td className={company.hiring_signal_role || company.hot_lead ? '' : 'v2-table-muted'}>
        {[
          company.hot_lead && 'Hot lead',
          company.hiring_signal_role && `Hiring: ${company.hiring_signal_role.replace(/_/g, ' ')}`,
        ].filter(Boolean).join(' · ') || '—'}
      </td>
      <td><StatusMark status={accountStatus} /></td>
      <td className={hasEvidence ? '' : 'v2-table-muted'}>
        {hasEvidence
          ? `${company.signal_count} signal${company.signal_count === 1 ? '' : 's'} · ${company.opportunity_count} opp${company.opportunity_count === 1 ? '' : 's'}`
          : '—'}
      </td>
      <td className={company.contact_count ? '' : 'v2-table-muted'}>{company.contact_count || 0}</td>
      <td>
        <span className={`v2-status-pill tone-${company.outreached ? 'success-solid' : 'neutral'}`}>
          {company.outreached ? 'Reached out' : 'Not yet'}
        </span>
      </td>
      <td className="v2-table-muted" title={added?.exact}>{added ? added.label : '—'}</td>
      <td>
        <Link to={`/v2/accounts/${company.id}`} className="v2-btn" style={{ padding: '0.35rem 0.6rem', whiteSpace: 'nowrap' }}>
          Open <IconChevronRight width={12} height={12} />
        </Link>
      </td>
    </tr>
  )
}

// Answers "which accounts should I look at, and where is each one in the GTM-OS journey" --
// not "show me every database field." account_status/signal_count/opportunity_count come from
// list_account_states() (app/gtm_os/account_agent/account_agent.py), scoped per-page via the
// same bulk-query pattern summarize_account_states() already uses for the funnel strip -- never
// one build_account_brief() call per row. Hot lead/hiring-role are real V1 signals, kept as
// secondary context, not the row's primary identity. "Qualified" (a V1 pipeline-eligibility
// gate, unrelated to GTM-OS state) is deliberately not shown here -- still present in the raw
// API response for the detail view if needed, just not surfaced on this list.
export default function Accounts() {
  const [searchParams, setSearchParams] = useSearchParams()
  const accountFilter = searchParams.get('filter') || ''

  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    getAccountsSummary().then(setSummary).catch(() => setSummary(null))
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      setSearch(searchInput)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listAccounts({ page, pageSize: PAGE_SIZE, search, accountFilter })
      .then(data => {
        if (cancelled) return
        setCompanies(data.companies)
        setTotal(data.total)
        setTotalPages(data.total_pages)
      })
      .catch(err => {
        if (cancelled) return
        setError(formatApiError(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [page, search, accountFilter])

  return (
    <div className="v2-accounts-page">
      <p className="v2-accounts-subtitle">Your account intelligence workspace</p>

      <SummaryStrip summary={summary} />

      {accountFilter && FILTER_LABEL[accountFilter] && (
        <div className="v2-active-filter">
          <span>Showing: <strong>{FILTER_LABEL[accountFilter]}</strong> ({total})</span>
          <button type="button" onClick={() => { setSearchParams({}); setPage(1) }}>
            <IconX width={13} height={13} /> Clear
          </button>
        </div>
      )}

      <div className="v2-accounts-toolbar">
        <span className="v2-accounts-count">{total || summary?.total_accounts || 0} accounts</span>
        <input
          type="text"
          className="v2-accounts-search"
          placeholder="Search accounts, domains, industries..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
        />
      </div>

      {error ? (
        <div className="v2-card">
          <div className="v2-state v2-state-error">
            <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
            <div>Couldn't load accounts: {error}</div>
          </div>
        </div>
      ) : loading ? (
        <div className="v2-accounts-grid">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="v2-skeleton-row" style={{ height: 40, borderRadius: 'var(--v2-radius)' }} />)}
        </div>
      ) : companies.length === 0 ? (
        <div className="v2-card">
          <div className="v2-state">
            {search ? `No accounts match "${search}".` : accountFilter ? 'No accounts currently match this filter.' : 'No accounts have been researched yet.'}
          </div>
        </div>
      ) : (
        <>
          <div className="v2-table-wrap">
            <table className="v2-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Size</th>
                  <th>Signal</th>
                  <th>Status</th>
                  <th>Evidence</th>
                  <th>Contacts</th>
                  <th>Outreach</th>
                  <th>Added</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {companies.map(c => <AccountRow key={c.id} company={c} />)}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="v2-pagination">
              <button type="button" onClick={() => setPage(p => p - 1)} disabled={page <= 1} aria-label="Previous page">
                <IconChevronLeft width={14} height={14} />
              </button>
              <span>Page {page} of {totalPages} · {total} accounts</span>
              <button type="button" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} aria-label="Next page">
                <IconChevronRight width={14} height={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
