import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listProposals, deleteProposal, formatApiError } from '../api.js'
import { IconAlertTriangle, IconEdit, IconTrash, IconFileText } from '../icons.jsx'

// Proposals -- the imported 2025 Sales Progress backlog today, and the durable home for any
// future proposal (system-generated or manual) going forward -- see Proposal's own docstring in
// app/db/models.py for why this isn't a one-off list. No auto-validation, re-engagement, or send
// logic here yet: Deepline validation costs credits, so review/edit/removal is manual, from this
// UI, until that's worth automating. Table layout + dedicated edit page, same pattern as CRM.
const STATUS_TONE = {
  accepted: 'tone-success-solid',
  in_pipeline: 'tone-warning-soft',
  sent: 'tone-accent-soft',
  stalled: 'tone-warning-soft',
  rejected: 'tone-danger-soft',
  unknown: 'tone-neutral',
}

const STATUS_LABEL = {
  accepted: 'Accepted',
  in_pipeline: 'In pipeline',
  sent: 'Sent',
  stalled: 'Stalled',
  rejected: 'Rejected',
  unknown: 'Unknown',
}

function StatusPill({ status }) {
  const tone = STATUS_TONE[status] || 'tone-neutral'
  return <span className={`v2-status-pill ${tone}`}>{STATUS_LABEL[status] || status}</span>
}

export default function Proposals() {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [total, setTotal] = useState(0)

  const [deleting, setDeleting] = useState(null)
  const [deletingBusy, setDeletingBusy] = useState(false)

  const load = (p = page) => {
    setLoading(true)
    setError(null)
    listProposals({ page: p, pageSize: 25, search: search.trim(), status })
      .then(data => {
        setRows(data.proposals)
        setTotalPages(data.total_pages)
        setTotal(data.total)
        setPage(data.page)
      })
      .catch(err => setError(formatApiError(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const runSearch = () => load(1)

  const handleDelete = () => {
    setDeletingBusy(true)
    deleteProposal(deleting.id)
      .then(() => {
        setRows(r => r.filter(x => x.id !== deleting.id))
        setTotal(t => t - 1)
        setDeleting(null)
      })
      .catch(err => setError(formatApiError(err)))
      .finally(() => setDeletingBusy(false))
  }

  return (
    <div>
      <div className="v2-page-head">
        <div className="v2-page-eyebrow">
          {total ? `${total} proposals -- past and future, in one place` : 'Past and future proposals, in one place'}
        </div>
        <h1 className="v2-page-title">Proposals</h1>
      </div>

      <div className="v2-toolbar">
        <input
          type="text" className="v2-search-input" placeholder="Search company…"
          value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') runSearch() }}
        />
        <select className="v2-select" style={{ maxWidth: '200px' }} value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="sent">Sent</option>
          <option value="in_pipeline">In pipeline</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="stalled">Stalled</option>
          <option value="unknown">Unknown</option>
        </select>
        <button type="button" className="v2-btn" onClick={runSearch}>Search</button>
      </div>

      {error && <p className="v2-state v2-state-error"><IconAlertTriangle /> {error}</p>}

      {loading && rows === null && <div className="v2-state">Loading proposals…</div>}

      {rows !== null && rows.length === 0 && !loading && (
        <div className="v2-state">No proposals found.</div>
      )}

      {rows !== null && rows.length > 0 && (
        <div className="v2-table-wrap">
          <table className="v2-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Status</th>
                <th>ICP fit</th>
                <th>Sent period</th>
                <th>Why not closed</th>
                <th>Monthly value</th>
                <th>Doc</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.id}>
                  <td>{p.company_name}</td>
                  <td><StatusPill status={p.status} /></td>
                  <td className={p.icp_fit && p.icp_fit !== 'unknown' ? '' : 'v2-table-muted'}>{p.icp_fit || '—'}</td>
                  <td className={p.sent_period ? '' : 'v2-table-muted'}>{p.sent_period || '—'}</td>
                  <td className={p.why_not_closed ? '' : 'v2-table-muted'}>{p.why_not_closed || '—'}</td>
                  <td className={p.monthly_value != null ? '' : 'v2-table-muted'}>{p.monthly_value != null ? p.monthly_value : '—'}</td>
                  <td className={p.has_document ? '' : 'v2-table-muted'}>
                    {p.has_document ? <IconFileText title={p.proposal_document_filename} /> : '—'}
                  </td>
                  <td>
                    <div className="v2-table-actions">
                      <Link to={`/v2/operations/proposals/${p.id}`} className="v2-btn" title="Edit" style={{ padding: '0.35rem 0.55rem' }}>
                        <IconEdit />
                      </Link>
                      <button
                        type="button" className="v2-btn-danger v2-btn" title="Delete"
                        onClick={() => setDeleting(p)} style={{ padding: '0.35rem 0.55rem' }}
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows !== null && totalPages > 1 && (
        <div className="v2-pagination">
          <button type="button" onClick={() => load(page - 1)} disabled={page <= 1 || loading}>Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button type="button" onClick={() => load(page + 1)} disabled={page >= totalPages || loading}>Next</button>
        </div>
      )}

      {deleting && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => setDeleting(null)}
        >
          <div className="v2-card" style={{ width: '380px', maxWidth: '92vw' }} onClick={e => e.stopPropagation()}>
            <div className="v2-section-title" style={{ marginBottom: '0.6rem' }}>Remove this proposal?</div>
            <p style={{ fontSize: '0.86rem', color: 'var(--v2-text-muted)', marginBottom: '1.2rem' }}>
              This permanently removes <strong>{deleting.company_name}</strong> from the Proposals list.
            </p>
            <div className="v2-btn-row">
              <button type="button" className="v2-btn-danger v2-btn" disabled={deletingBusy} onClick={handleDelete}>
                {deletingBusy ? 'Removing…' : 'Remove'}
              </button>
              <button type="button" className="v2-btn" onClick={() => setDeleting(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
