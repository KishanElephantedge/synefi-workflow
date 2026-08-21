import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listAccounts, getAccountsSummary, formatApiError } from '../api.js'
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

// Every row shares the SAME structural grid (company / intelligence / action) regardless of
// state -- hierarchy comes from chip intensity, accent color, and which cells have content,
// never from switching between a "plain row" and a "boxed card" per tier. Consistent column
// alignment means every status chip and every CTA lines up down the page.
function AccountCard({ company }) {
  // account_status defaults to 'insufficient_context' when absent (e.g. an older backend
  // that hasn't deployed list_account_states() yet) rather than rendering a blank badge --
  // the safest, least-alarming fallback, matching how every account starts out anyway.
  const accountStatus = company.account_status || 'insufficient_context'
  const isQuiet = QUIET_STATES.has(accountStatus)
  const hasEvidence = !isQuiet && ((company.signal_count > 0) || (company.opportunity_count > 0))
  const secondaryText = [
    company.hot_lead && 'Hot lead',
    company.hiring_signal_role && `hiring: ${company.hiring_signal_role.replace(/_/g, ' ')}`,
  ].filter(Boolean).join(' · ')

  return (
    <Link to={`/v2/accounts/${company.id}`} className={`v2-account-row-grid v2-account-state-${accountStatus}`}>
      <div className="v2-ar-company">
        <div className="v2-account-name">{company.name}</div>
        <div className="v2-account-meta">
          {[company.domain, company.industry].filter(Boolean).join(' · ') || 'No domain or industry on file'}
        </div>
        {secondaryText && <div className="v2-account-secondary">{secondaryText}</div>}
      </div>

      <div className="v2-ar-intel">
        <StatusMark status={accountStatus} />
        {hasEvidence && (
          <div className="v2-account-evidence">
            <span className="v2-account-evidence-stat">{company.signal_count} signal{company.signal_count === 1 ? '' : 's'}</span>
            <span className="v2-account-evidence-stat">{company.opportunity_count} opportunit{company.opportunity_count === 1 ? 'y' : 'ies'}</span>
          </div>
        )}
      </div>

      <div className="v2-account-cta">
        <span>Open Account Agent</span>
        <IconChevronRight width={14} height={14} />
      </div>
    </Link>
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
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="v2-skeleton-row" style={{ height: 96, borderRadius: 'var(--v2-radius)' }} />)}
        </div>
      ) : companies.length === 0 ? (
        <div className="v2-card">
          <div className="v2-state">
            {search ? `No accounts match "${search}".` : accountFilter ? 'No accounts currently match this filter.' : 'No accounts have been researched yet.'}
          </div>
        </div>
      ) : (
        <>
          <div className="v2-accounts-grid">
            {companies.map(c => <AccountCard key={c.id} company={c} />)}
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
