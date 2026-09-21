import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPartnerAccounts, formatApiError } from '../v2/api.js'

// Deliberately minimal, not a reuse of v2/pages/Accounts.jsx. That page's summary tiles and
// hot-lead/no-contact filters read from /gtm-os/accounts/summary and jobs_to_be_done state --
// neither of which is scoped to a partner tenant today, and a stage-1 partner tenant has no
// ICP/opportunity pipeline populated to summarize anyway. This shows exactly what stage 1
// promises: the accounts fetched for this tenant, and a click into each one.
//
// ONE list, not one page per objective (2026-09-22, explicit correction after a first version
// put engagement-mining leads on their own sidebar tab -- "I never told you to separate that
// into a different tab... add filters. All and these two. So all will be listed. All tab will
// be default. And the design will be same"). Rows can be either a Company (firmographic ICP
// discovery) or an engagement-mining lead (no Company row at all -- see getPartnerAccounts'
// own backend docstring) -- the SOURCE column and filter pills are what distinguish them, the
// table shape stays the same either way.
//
// Table, not a card grid (2026-09-13, explicit instruction: "what if when we scale up... to
// hundreds of accounts, this is not currently [set up] to present it"). A card grid caps out
// readably around a couple dozen tiles; a table keeps hundreds of rows scannable at a glance.
function formatSize(row) {
  const parts = []
  if (row.employee_count) parts.push(`${row.employee_count} emp`)
  if (row.estimated_revenue_lower_usd) {
    const fmt = (n) => n >= 1_000_000 ? `$${Math.round(n / 1_000_000)}M` : `$${Math.round(n / 1000)}K`
    parts.push(
      row.estimated_revenue_higher_usd && row.estimated_revenue_higher_usd !== row.estimated_revenue_lower_usd
        ? `${fmt(row.estimated_revenue_lower_usd)}-${fmt(row.estimated_revenue_higher_usd)}`
        : fmt(row.estimated_revenue_lower_usd)
    )
  }
  return parts.join(' · ')
}

const PAGE_SIZE = 25

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'firmographic', label: 'Firmographic ICP discovery' },
  { value: 'engagement', label: 'Engagement mining' },
]

// "When we click yesterday it shows the discovery... and the list of that period below" (2026-
// 09-16, explicit instruction: "for the partners let for them also be filters"). Kept across
// the source-filter merge (2026-09-22) -- filters on when a row was actually found, the one
// real date fact both objectives share.
const PERIOD_PRESETS = [
  { value: '1', label: 'Today' },
  { value: '7', label: 'Past 7 days' },
  { value: '30', label: 'Past 30 days' },
  { value: 'custom', label: 'Custom range' },
]

export default function PartnerAccounts({ basePath = '/partner' }) {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState([])
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [periodPreset, setPeriodPreset] = useState('')
  const [periodDateFrom, setPeriodDateFrom] = useState('')
  const [periodDateTo, setPeriodDateTo] = useState('')
  const [periodStats, setPeriodStats] = useState(null)
  const periodDays = periodPreset && periodPreset !== 'custom' ? Number(periodPreset) : 0

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getPartnerAccounts({ page, pageSize: PAGE_SIZE, search, sourceFilter, periodDays, periodDateFrom, periodDateTo })
      .then((data) => {
        if (cancelled) return
        setAccounts(data.accounts || [])
        setTotal(data.total || 0)
        setCounts(data.counts || null)
        setPeriodStats(data.period_stats || null)
      })
      .catch((err) => {
        if (cancelled) return
        setError(formatApiError(err))
      })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [page, search, sourceFilter, periodDays, periodDateFrom, periodDateTo])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <div className="partnerAccountsHeader">
        <h1>Accounts</h1>
        <p>Companies matched to your ICP and people found through LinkedIn engagement mining, in one list.</p>
      </div>

      <div className="partnerFilterPills">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={`partnerFilterPill${sourceFilter === f.value ? ' partnerFilterPillActive' : ''}`}
            onClick={() => { setPage(1); setSourceFilter(f.value) }}
          >
            {f.label}
            {counts && <span className="partnerFilterPillCount">{counts[f.value]}</span>}
          </button>
        ))}
      </div>

      <div className="partnerSearchRow">
        <input
          className="partnerSearchInput"
          type="text"
          placeholder="Search by name, domain, or industry"
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value) }}
        />
        <select
          className="partnerPeriodSelect"
          value={periodPreset}
          onChange={(e) => { setPage(1); setPeriodPreset(e.target.value); setPeriodDateFrom(''); setPeriodDateTo('') }}
          aria-label="Filter accounts by when they were fetched"
        >
          <option value="">Fetched — any time</option>
          {PERIOD_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        {periodPreset === 'custom' && (
          <>
            <input type="date" className="partnerSearchInput" style={{ maxWidth: 160 }} value={periodDateFrom}
                   onChange={(e) => { setPage(1); setPeriodDateFrom(e.target.value) }} aria-label="Fetched from" />
            <span>to</span>
            <input type="date" className="partnerSearchInput" style={{ maxWidth: 160 }} value={periodDateTo}
                   onChange={(e) => { setPage(1); setPeriodDateTo(e.target.value) }} aria-label="Fetched to" />
          </>
        )}
      </div>

      {periodStats && (
        <div className="partnerPeriodStats">
          <div><strong>{periodStats.companies_fetched}</strong> companies fetched</div>
          <div><strong>{periodStats.decision_makers_fetched}</strong> decision-makers fetched</div>
          <div><strong>{periodStats.pushed_to_campaigns}</strong> pushed to campaigns</div>
        </div>
      )}

      {loading ? (
        <div className="partnerLoadingState">Loading...</div>
      ) : error ? (
        <div className="partnerErrorState">{error}</div>
      ) : accounts.length === 0 ? (
        <div className="partnerCardWrap">
          <div className="partnerEmptyState">
            {search ? 'No accounts match that search.' : 'No accounts yet -- check back soon.'}
          </div>
        </div>
      ) : (
        <div className="partnerTableWrap">
          <table className="partnerTable">
            <thead>
              <tr>
                <th>Company</th>
                <th>Industry</th>
                <th>Size</th>
                <th>Signal</th>
                <th>Source</th>
                <th>Contacts</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((row) => {
                const size = formatSize(row)
                const isCompany = row.kind === 'company'
                const goTo = () => navigate(`${basePath}/accounts/${row.id}`)
                return (
                  <tr
                    key={row.id}
                    className="partnerTableRowLink"
                    onClick={goTo}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goTo() } }}
                  >
                    <td>
                      <div className="partnerTableCompanyRow">
                        <div className="partnerAccountLogo partnerAccountLogoSm">{(row.name || '?').slice(0, 1).toUpperCase()}</div>
                        <div>
                          <div className="partnerAccountName">{row.name || '—'}</div>
                          <div className="partnerAccountDomain">{isCompany ? (row.domain || '—') : 'LinkedIn engagement'}</div>
                        </div>
                      </div>
                    </td>
                    <td className={row.industry ? '' : 'partnerTableMuted'}>{row.industry || '—'}</td>
                    <td className={size ? '' : 'partnerTableMuted'}>{size || '—'}</td>
                    <td className={row.signal ? '' : 'partnerTableMuted'}>{row.signal || '—'}</td>
                    <td className={row.source_label ? '' : 'partnerTableMuted'}>{row.source_label || '—'}</td>
                    <td className={row.contact_count ? '' : 'partnerTableMuted'}>{row.contact_count ?? '—'}</td>
                    <td>
                      <span className="partnerTableAction">
                        {isCompany ? 'View decision-makers' : 'View lead'} <span className="partnerAccountArrow">→</span>
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && total > PAGE_SIZE && (
        <div className="partnerPagination">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </div>
  )
}
