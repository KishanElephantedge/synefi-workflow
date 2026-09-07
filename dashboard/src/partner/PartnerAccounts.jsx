import { useEffect, useState } from 'react'
import { listAccounts, formatApiError } from '../v2/api.js'

// Deliberately minimal, not a reuse of v2/pages/Accounts.jsx. That page's summary tiles and
// hot-lead/no-contact filters read from /gtm-os/accounts/summary and jobs_to_be_done state --
// neither of which is scoped to a partner tenant today, and a stage-1 partner tenant (created
// fresh, or a bare discovery-pipeline data boundary like Sandy's) has no ICP/opportunity
// pipeline populated to summarize anyway. Showing those tiles here would either error or show
// someone else's numbers. This shows exactly what stage 1 promises: the accounts fetched for
// this tenant, nothing else.
const PAGE_SIZE = 25

export default function PartnerAccounts() {
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
        <p>Companies we&apos;ve fetched for you, matched to your ICP.</p>
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

      <div className="partnerTableWrap">
        {loading ? (
          <div className="partnerLoadingState">Loading...</div>
        ) : error ? (
          <div className="partnerErrorState">{error}</div>
        ) : companies.length === 0 ? (
          <div className="partnerEmptyState">
            {search ? 'No companies match that search.' : 'No accounts yet -- check back soon.'}
          </div>
        ) : (
          <table className="partnerTable">
            <thead>
              <tr>
                <th>Company</th>
                <th>Domain</th>
                <th>Industry</th>
                <th>LinkedIn</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.domain || '—'}</td>
                  <td>{c.industry || '—'}</td>
                  <td>
                    {c.linkedin_url ? (
                      <a href={c.linkedin_url} target="_blank" rel="noreferrer">View</a>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
