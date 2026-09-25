import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { listAccounts, getAccountsSummary, getCompaniesExportUrl, formatApiError } from '../api.js'
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
  const navigate = useNavigate()
  const accountStatus = company.account_status || 'insufficient_context'
  const isQuiet = QUIET_STATES.has(accountStatus)
  const hasEvidence = !isQuiet && ((company.signal_count > 0) || (company.opportunity_count > 0))
  const added = formatRecency(company.created_at)
  const size = formatSize(company)
  const linkedinHref = company.linkedin_url
    ? (company.linkedin_url.startsWith('http') ? company.linkedin_url : `https://${company.linkedin_url}`)
    : null

  // Whole row opens the detail page (explicit ask 2026-09-26: "wherever we click on that row it
  // should open"), while the company-name link (LinkedIn) and the explicit Open button/chevron
  // stay their own separate clicks -- stopPropagation on those so a LinkedIn click doesn't also
  // navigate to the detail page underneath it.
  return (
    <tr
      className={`v2-account-state-${accountStatus} v2-account-row-clickable`}
      onClick={() => navigate(`/v2/accounts/${company.id}`)}
    >
      <td>
        {linkedinHref ? (
          <a
            href={linkedinHref} target="_blank" rel="noreferrer"
            className="v2-account-name" onClick={e => e.stopPropagation()}
          >
            {company.name}
          </a>
        ) : (
          <div className="v2-account-name">{company.name}</div>
        )}
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
      <td className={company.resolved_offering_name ? '' : 'v2-table-muted'}>{company.resolved_offering_name || '—'}</td>
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
        {company.outreached && company.outreached_at && (
          <div className="v2-table-muted" style={{ marginTop: 2 }} title={formatRecency(company.outreached_at)?.exact}>
            {formatRecency(company.outreached_at)?.label}
          </div>
        )}
      </td>
      <td className="v2-table-muted" title={added?.exact}>{added ? added.label : '—'}</td>
      <td>
        <Link
          to={`/v2/accounts/${company.id}`} className="v2-btn" style={{ padding: '0.35rem 0.6rem', whiteSpace: 'nowrap' }}
          onClick={e => e.stopPropagation()}
        >
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
// "When we click yesterday, it shows the discovery -- number of companies, number of decision
// makers, and pushed -- and the list of that period below" (explicit instruction, 2026-09-16,
// after correcting an earlier "sent" framing). Filters on Company.created_at (when a company
// was actually fetched), not CampaignPush.pushed_at -- that's what makes this meaningful for
// every tenant, including partners, who never get pushed to a campaign at all. Presets are
// plain day counts (period_days=1/7/30), not baked-in special cases, so "any range" already
// works via the same query param; Custom just exposes two date inputs for an exact range.
// Lives in the URL (?period=...) the same way the Jobs-to-Be-Done `filter` param already does,
// so a filtered view is bookmarkable/shareable.
const PERIOD_PRESETS = [
  { value: '1', label: 'Today' },
  { value: '7', label: 'Past 7 days' },
  { value: '30', label: 'Past 30 days' },
  { value: 'custom', label: 'Custom range' },
]

function PeriodFilter({ value, onChange, dateFrom, dateTo, onDateFromChange, onDateToChange }) {
  return (
    <div className="v2-outreach-filter">
      <select
        className="v2-select"
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label="Filter accounts by when they were fetched"
      >
        <option value="">Fetched — any time</option>
        {PERIOD_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
      </select>
      {value === 'custom' && (
        <>
          <input type="date" className="v2-input" value={dateFrom} onChange={e => onDateFromChange(e.target.value)} aria-label="Fetched from" />
          <span className="v2-table-muted">to</span>
          <input type="date" className="v2-input" value={dateTo} onChange={e => onDateToChange(e.target.value)} aria-label="Fetched to" />
        </>
      )}
    </div>
  )
}

// The 3 real numbers for the selected period, computed server-side independent of search/other
// filters (app/routes/api.py's period_stats) -- shown only once a period is actually selected.
function PeriodStatsBar({ stats }) {
  if (!stats) return null
  return (
    <div className="v2-period-stats">
      <div className="v2-period-stat">
        <span className="v2-period-stat-value">{stats.companies_fetched}</span>
        <span className="v2-period-stat-label">Companies fetched</span>
      </div>
      <div className="v2-period-stat">
        <span className="v2-period-stat-value">{stats.decision_makers_fetched}</span>
        <span className="v2-period-stat-label">Decision-makers fetched</span>
      </div>
      <div className="v2-period-stat">
        <span className="v2-period-stat-value">{stats.pushed_to_campaigns}</span>
        <span className="v2-period-stat-label">Pushed to campaigns</span>
      </div>
    </div>
  )
}

// Same column keys as app/routes/api.py's _COMPANY_EXPORT_COLUMNS / _CONTACT_EXPORT_COLUMNS --
// a fixed, mirrored contract (this codebase's established pattern, same as STAGES/FIT_OPTIONS
// elsewhere), not derived from a schema call, since the export is a stable, small column set.
const EXPORT_COMPANY_COLUMNS = [
  ['company_id', 'Company ID'], ['company_name', 'Company Name'], ['domain', 'Domain'], ['industry', 'Industry'],
  ['company_linkedin_url', 'Company LinkedIn URL'], ['employee_count', 'Employee Count'],
  ['revenue_lower_usd', 'Revenue Lower (USD)'], ['revenue_higher_usd', 'Revenue Higher (USD)'],
  ['account_status', 'Account Status'], ['qualified', 'Qualified'], ['resolved_offering_name', 'Offering'],
  ['hiring_signal_role', 'Hiring Signal Role'], ['hot_lead', 'Hot Lead'], ['hot_lead_reasoning', 'Hot Lead Reasoning'],
  ['contact_count', 'Contact Count'], ['company_outreached', 'Company Outreached'], ['source', 'Source'],
  ['company_added_at', 'Company Added'],
]
const EXPORT_CONTACT_COLUMNS = [
  ['contact_id', 'Contact ID'], ['first_name', 'First Name'], ['last_name', 'Last Name'], ['title', 'Title'],
  ['contact_linkedin_url', 'Contact LinkedIn URL'], ['email', 'Email'], ['email_source', 'Email Source'],
  ['contact_outreached', 'Contact Outreached'], ['contact_added_at', 'Contact Added'],
]
const EXPORT_SCOPES = [
  { value: 'all', label: 'All (companies + decision-makers)' },
  { value: 'companies', label: 'Companies only' },
  { value: 'contacts', label: 'Contacts only' },
]

// "add a new feature to download the csv file and in that add what and all we can download"
// (explicit ask 2026-09-26) -- scope picker (all/companies/contacts) + per-column checkboxes,
// respecting whatever search/filter is currently active on the page, same as the download does
// on the Sandy CRM page.
function ExportPanel({ filters }) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState('all')
  const [selectedColumns, setSelectedColumns] = useState(() => new Set([
    ...EXPORT_COMPANY_COLUMNS.map(c => c[0]), ...EXPORT_CONTACT_COLUMNS.map(c => c[0]),
  ]))
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = e => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const visibleColumnGroups = scope === 'companies'
    ? [['Company columns', EXPORT_COMPANY_COLUMNS]]
    : scope === 'contacts'
      ? [['Contact columns', EXPORT_CONTACT_COLUMNS]]
      : [['Company columns', EXPORT_COMPANY_COLUMNS], ['Contact columns', EXPORT_CONTACT_COLUMNS]]

  const toggleColumn = key => setSelectedColumns(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  })
  const setAllInScope = (checked) => setSelectedColumns(prev => {
    const next = new Set(prev)
    const keys = visibleColumnGroups.flatMap(([, cols]) => cols.map(c => c[0]))
    keys.forEach(k => checked ? next.add(k) : next.delete(k))
    return next
  })

  const relevantSelected = visibleColumnGroups.flatMap(([, cols]) => cols.map(c => c[0])).filter(k => selectedColumns.has(k))
  const downloadUrl = getCompaniesExportUrl({ ...filters, scope, columns: relevantSelected })

  return (
    <div className="v2-export-panel-wrap" ref={ref}>
      <button type="button" className="v2-btn" onClick={() => setOpen(o => !o)}>Download CSV</button>
      {open && (
        <div className="v2-export-panel">
          <div className="v2-export-panel-section-title">What to download</div>
          <div className="v2-export-scope-options">
            {EXPORT_SCOPES.map(s => (
              <label key={s.value} className="v2-export-scope-option">
                <input type="radio" name="export-scope" value={s.value} checked={scope === s.value} onChange={() => setScope(s.value)} />
                {s.label}
              </label>
            ))}
          </div>
          <div className="v2-export-panel-section-title" style={{ marginTop: '0.75rem' }}>
            Columns
            <button type="button" className="v2-link-btn" onClick={() => setAllInScope(true)}>All</button>
            <button type="button" className="v2-link-btn" onClick={() => setAllInScope(false)}>None</button>
          </div>
          <div className="v2-export-columns">
            {visibleColumnGroups.map(([groupLabel, cols]) => (
              <div key={groupLabel} className="v2-export-column-group">
                <div className="v2-export-column-group-title">{groupLabel}</div>
                {cols.map(([key, label]) => (
                  <label key={key} className="v2-export-column-option">
                    <input type="checkbox" checked={selectedColumns.has(key)} onChange={() => toggleColumn(key)} />
                    {label}
                  </label>
                ))}
              </div>
            ))}
          </div>
          <a
            className="v2-btn v2-btn-primary v2-export-download-btn"
            href={relevantSelected.length ? downloadUrl : undefined}
            aria-disabled={relevantSelected.length === 0}
            onClick={e => { if (!relevantSelected.length) e.preventDefault(); else setOpen(false) }}
          >
            Download {relevantSelected.length === 0 ? '(select at least one column)' : `(${relevantSelected.length} columns)`}
          </a>
        </div>
      )}
    </div>
  )
}

export default function Accounts() {
  const [searchParams, setSearchParams] = useSearchParams()
  const accountFilter = searchParams.get('filter') || ''
  const periodPreset = searchParams.get('period') || ''
  const periodDateFrom = searchParams.get('period_from') || ''
  const periodDateTo = searchParams.get('period_to') || ''
  const periodDays = periodPreset && periodPreset !== 'custom' ? Number(periodPreset) : 0

  const setPeriodPreset = (val) => {
    const next = new URLSearchParams(searchParams)
    if (val) next.set('period', val); else next.delete('period')
    next.delete('period_from'); next.delete('period_to')
    setSearchParams(next)
    setPage(1)
  }
  const setPeriodDateFrom = (val) => {
    const next = new URLSearchParams(searchParams)
    if (val) next.set('period_from', val); else next.delete('period_from')
    setSearchParams(next)
    setPage(1)
  }
  const setPeriodDateTo = (val) => {
    const next = new URLSearchParams(searchParams)
    if (val) next.set('period_to', val); else next.delete('period_to')
    setSearchParams(next)
    setPage(1)
  }

  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [summary, setSummary] = useState(null)
  const [periodStats, setPeriodStats] = useState(null)

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
    listAccounts({ page, pageSize: PAGE_SIZE, search, accountFilter, periodDays, periodDateFrom, periodDateTo })
      .then(data => {
        if (cancelled) return
        setCompanies(data.companies)
        setTotal(data.total)
        setTotalPages(data.total_pages)
        setPeriodStats(data.period_stats || null)
      })
      .catch(err => {
        if (cancelled) return
        setError(formatApiError(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [page, search, accountFilter, periodDays, periodDateFrom, periodDateTo])

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
        <div className="v2-accounts-toolbar-right">
          <input
            type="text"
            className="v2-accounts-search"
            placeholder="Search accounts, domains, industries..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
          <PeriodFilter
            value={periodPreset}
            onChange={setPeriodPreset}
            dateFrom={periodDateFrom}
            dateTo={periodDateTo}
            onDateFromChange={setPeriodDateFrom}
            onDateToChange={setPeriodDateTo}
          />
          <ExportPanel filters={{ search, accountFilter, periodDays, periodDateFrom, periodDateTo }} />
        </div>
      </div>

      <PeriodStatsBar stats={periodStats} />

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
                  <th>Offered</th>
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
