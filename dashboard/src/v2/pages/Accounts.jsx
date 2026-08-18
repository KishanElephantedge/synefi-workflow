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

function SummaryStrip({ summary }) {
  if (!summary) return null
  return (
    <div className="v2-stat-row">
      <div className="v2-stat-tile">
        <div className="v2-stat-label">Total accounts</div>
        <div className="v2-stat-value">{summary.total_accounts}</div>
      </div>
      {SUMMARY_TILES.map(([key, label]) => (
        <div className="v2-stat-tile" key={key}>
          <div className="v2-stat-label">{label}</div>
          <div className="v2-stat-value">{summary.account_states[key] ?? 0}</div>
        </div>
      ))}
    </div>
  )
}

// Hiring-signal strength -> the same three-tier vocabulary hiring_signal.py already uses
// (strong | medium | weak) -- never re-derived, just colored.
const STRENGTH_BADGE = {
  strong: 'v2-badge-success',
  medium: 'v2-badge-warning',
  weak: 'v2-badge-neutral',
}

function AccountRow({ company }) {
  return (
    <Link to={`/v2/accounts/${company.id}`} className="v2-account-row">
      <div className="v2-account-identity">
        <div className="v2-account-name">
          {company.name}
          {company.hot_lead && <span className="v2-badge v2-badge-danger">Hot lead</span>}
        </div>
        <div className="v2-account-meta">
          {[company.domain, company.industry].filter(Boolean).join(' · ') || 'No domain or industry on file'}
        </div>
      </div>
      <div className="v2-account-tags">
        {company.qualified && <span className="v2-badge v2-badge-info">Qualified</span>}
        {company.hiring_signal_role && (
          <span className={`v2-badge ${STRENGTH_BADGE[company.hiring_signal_strength] || 'v2-badge-neutral'}`}>
            {company.hiring_signal_role.replace(/_/g, ' ')}
          </span>
        )}
      </div>
    </Link>
  )
}

// Answers "which accounts should I look at" -- not "show me every database field." Columns are
// deliberately limited to what's real, already computed server-side, and decision-relevant
// (name/domain/industry identity, qualified gate, hiring signal, hot-lead flag). ICP match,
// offering fit, and GTM motion are real GTM-OS concepts but are NOT in this list response (see
// api.js) -- they only become available per-account on Account 360, where the cost of computing
// them for one company is trivial; computing them for every row of a 25-company page would mean
// 25x the backend work per list view, which this endpoint doesn't do and Phase 2 doesn't add.
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
    <div>
      <SummaryStrip summary={summary} />

      {accountFilter && FILTER_LABEL[accountFilter] && (
        <div className="v2-active-filter">
          <span>Showing: <strong>{FILTER_LABEL[accountFilter]}</strong> ({total})</span>
          <button type="button" onClick={() => { setSearchParams({}); setPage(1) }}>
            <IconX width={13} height={13} /> Clear
          </button>
        </div>
      )}

      <div className="v2-toolbar">
        <input
          type="text"
          className="v2-search-input"
          placeholder="Search name, domain, industry..."
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
        <div className="v2-account-list">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="v2-skeleton-row" />)}
        </div>
      ) : companies.length === 0 ? (
        <div className="v2-card">
          <div className="v2-state">
            {search ? `No accounts match "${search}".` : accountFilter ? 'No accounts currently match this filter.' : 'No accounts have been researched yet.'}
          </div>
        </div>
      ) : (
        <>
          <div className="v2-account-list">
            {companies.map(c => <AccountRow key={c.id} company={c} />)}
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
