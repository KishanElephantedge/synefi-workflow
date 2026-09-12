import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAccounts, formatApiError } from '../v2/api.js'

// Deliberately minimal, not a reuse of v2/pages/Accounts.jsx. That page's summary tiles and
// hot-lead/no-contact filters read from /gtm-os/accounts/summary and jobs_to_be_done state --
// neither of which is scoped to a partner tenant today, and a stage-1 partner tenant has no
// ICP/opportunity pipeline populated to summarize anyway. This shows exactly what stage 1
// promises: the accounts fetched for this tenant, and a click into each one.
//
// Table, not a card grid (2026-09-13, explicit instruction: "what if when we scale up... to
// hundreds of accounts, this is not currently [set up] to present it"). A card grid caps out
// readably around a couple dozen tiles; a table keeps hundreds of rows scannable at a glance.
// Only real, already-returned fields are shown -- no status/evidence columns like V2's own
// Accounts table, since those come from list_account_states() which is hardcoded to Elephant
// Edge's tenant_id (app/routes/api.py) and would show meaningless data for a partner's own
// companies. Outreach status is also omitted: partners never get pushed to a campaign (their
// accounts land in the database only), so "reached out" has no real meaning here.
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

const PAGE_SIZE = 25

export default function PartnerAccounts({ basePath = '/partner' }) {
  const [companies, setCompanies] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    listAccounts({ page, pageSize: PAGE_SIZE, search })
      .then((data) => {
        if (cancelled) return
        setCompanies(data.companies || [])
        setTotal(data.total || 0)
      })
      .catch((err) => {
        if (cancelled) return
        setError(formatApiError(err))
      })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [page, search])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <div className="partnerAccountsHeader">
        <h1>Accounts</h1>
        <p>Companies matched to your ICP, with the decision-makers we found and enriched at each one.</p>
      </div>

      <div className="partnerSearchRow">
        <input
          className="partnerSearchInput"
          type="text"
          placeholder="Search by name, domain, or industry"
          value={search}
          onChange={(e) => { setPage(1); setSearch(e.target.value) }}
        />
      </div>

      {loading ? (
        <div className="partnerLoadingState">Loading...</div>
      ) : error ? (
        <div className="partnerErrorState">{error}</div>
      ) : companies.length === 0 ? (
        <div className="partnerCardWrap">
          <div className="partnerEmptyState">
            {search ? 'No companies match that search.' : 'No accounts yet -- check back soon.'}
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
                <th>Contacts</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => {
                const size = formatSize(c)
                const signal = [
                  c.hot_lead && 'Hot lead',
                  c.hiring_signal_role && `Hiring: ${c.hiring_signal_role.replace(/_/g, ' ')}`,
                ].filter(Boolean).join(' · ')
                return (
                  <tr key={c.id}>
                    <td>
                      <div className="partnerTableCompanyRow">
                        <div className="partnerAccountLogo partnerAccountLogoSm">{c.name.slice(0, 1).toUpperCase()}</div>
                        <div>
                          <div className="partnerAccountName">{c.name}</div>
                          <div className="partnerAccountDomain">{c.domain || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td className={c.industry ? '' : 'partnerTableMuted'}>{c.industry || '—'}</td>
                    <td className={size ? '' : 'partnerTableMuted'}>{size || '—'}</td>
                    <td className={signal ? '' : 'partnerTableMuted'}>{signal || '—'}</td>
                    <td className={c.contact_count ? '' : 'partnerTableMuted'}>{c.contact_count || 0}</td>
                    <td>
                      <Link className="partnerTableAction" to={`${basePath}/accounts/${c.id}`}>
                        View decision-makers <span className="partnerAccountArrow">→</span>
                      </Link>
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
