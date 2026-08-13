import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import client from '../api/client'

function qualifiedPillClass(qualified) {
  return qualified ? 'on' : 'off'
}

// Cross-batch company list -- previously the only way to see a company was inside its own
// batch. Reads an initial `qualified` filter from the URL (so Overview's drill-down cards
// land here pre-filtered), but the filter itself is still fully interactive afterward.
export default function Companies() {
  const { tenantSlug } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [qualifiedFilter, setQualifiedFilter] = useState(searchParams.get('qualified') || '')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)
  const PAGE_SIZE = 25

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      setSearch(searchInput)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    if (tenantSlug !== 'elephant-edge') return
    setLoading(true)
    client.get('/companies', { params: { page, page_size: PAGE_SIZE, search, qualified: qualifiedFilter } })
      .then(res => {
        setCompanies(res.data.companies)
        setTotalPages(res.data.total_pages)
        setTotal(res.data.total)
      })
      .catch(err => setError(err.response?.data?.detail || err.message))
      .finally(() => setLoading(false))
  }, [tenantSlug, page, search, qualifiedFilter])

  if (tenantSlug !== 'elephant-edge') {
    return (
      <div className="page">
        <div className="page-header"><h1>Companies</h1></div>
        <p className="hint">Not available for this workspace.</p>
      </div>
    )
  }

  return (
    <div className="page page-wide">
      <div className="page-header">
        <h1>Companies</h1>
        <p className="meta">Every company we've researched, across every batch.</p>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search name, domain, industry..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          style={{ flex: '1 1 240px', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
        />
        <select
          value={qualifiedFilter}
          onChange={e => { setPage(1); setQualifiedFilter(e.target.value) }}
          style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
        >
          <option value="">All companies</option>
          <option value="true">Qualified only</option>
          <option value="false">Not qualified</option>
        </select>
      </div>

      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Domain</th>
              <th>Industry</th>
              <th>Source</th>
              <th>Hiring Signal</th>
              <th>Team Fit</th>
              <th>Qualified</th>
            </tr>
          </thead>
          <tbody>
            {companies.map(c => (
              <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/${tenantSlug}/batches/${c.batch_id}`)}>
                <td>
                  {c.hot_lead && (
                    <span className="tier-badge tier-hot" title={c.hot_lead_reasoning || ''} style={{ marginRight: '0.5rem' }}>
                      Hot Lead
                    </span>
                  )}
                  {c.name}
                </td>
                <td>{c.domain || '-'}</td>
                <td>{c.industry || '-'}</td>
                <td>{c.source || '-'}</td>
                <td>{c.hiring_signal_role || '-'}</td>
                <td>{c.team_fit_tier || '-'}</td>
                <td><span className={`status-pill ${qualifiedPillClass(c.qualified)}`}>{c.qualified ? 'Qualified' : 'Not qualified'}</span></td>
              </tr>
            ))}
            {companies.length === 0 && (
              <tr><td colSpan={7} className="empty-state">{loading ? 'Loading companies...' : 'No companies match.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
          <button type="button" className="secondary btn-small" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>&larr; Prev</button>
          <span className="hint">Page {page} of {totalPages} ({total} companies)</span>
          <button type="button" className="secondary btn-small" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next &rarr;</button>
        </div>
      )}
    </div>
  )
}
