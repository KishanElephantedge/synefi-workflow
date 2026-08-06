import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import client from '../api/client'

const SOURCE_LABELS = {
  jd_first: 'JD-First (TheirStack)',
  jobo: 'Jobo',
  apify: 'Apify',
  deepline: 'Deepline (legacy)',
  manual: 'Manual',
}

export default function BatchList() {
  const [batches, setBatches] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [page, setPage] = useState(1)
  const [sourceFilter, setSourceFilter] = useState('')
  const [name, setName] = useState('')
  const [newBatchSource, setNewBatchSource] = useState('deepline')
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const { tenantSlug } = useParams()
  const isElephantEdge = tenantSlug === 'elephant-edge'
  const PAGE_SIZE = 10

  const load = () => {
    client.get('/batches', { params: { page, page_size: PAGE_SIZE, source: sourceFilter || undefined } })
      .then(res => {
        setBatches(res.data.batches)
        setTotal(res.data.total)
        setTotalPages(res.data.total_pages)
      })
      .catch(err => setError(err.message))
  }

  useEffect(load, [page, sourceFilter])

  const createBatch = async (e) => {
    e.preventDefault()
    if (!name.trim()) return
    try {
      const params = isElephantEdge ? { name, source: newBatchSource } : { name }
      const res = await client.post('/batches', null, { params })
      setName('')
      navigate(`/${tenantSlug}/batches/${res.data.id}`)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="page">
      {error && <p className="error">{error}</p>}

      <div className="card">
        <h2>New batch</h2>
        <form onSubmit={createBatch} className="inline-form">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="New batch name"
            style={{ minWidth: '16rem' }}
          />
          {isElephantEdge && (
            <select value={newBatchSource} onChange={e => setNewBatchSource(e.target.value)}>
              <option value="deepline">Deepline</option>
              <option value="jobo">Jobo</option>
            </select>
          )}
          <button type="submit">Create batch</button>
        </form>
      </div>

      {isElephantEdge && (
        <div style={{ marginBottom: '0.75rem' }}>
          <select value={sourceFilter} onChange={e => { setPage(1); setSourceFilter(e.target.value) }} style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <option value="">All sources</option>
            <option value="jd_first">JD-First (TheirStack)</option>
            <option value="jobo">Jobo</option>
            <option value="apify">Apify</option>
            <option value="deepline">Deepline (legacy)</option>
            <option value="manual">Manual</option>
          </select>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              {isElephantEdge && <th>Source</th>}
              <th>Phase</th>
              <th>Status</th>
              <th>Companies</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {batches.map(b => (
              <tr key={b.id}>
                <td><Link to={`/${tenantSlug}/batches/${b.id}`}>{b.name}</Link></td>
                {isElephantEdge && <td>{SOURCE_LABELS[b.source] || b.source}</td>}
                <td>{b.current_phase}</td>
                <td>{b.status}</td>
                <td>{b.company_count}</td>
                <td>{new Date(b.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {batches.length === 0 && (
              <tr><td colSpan={isElephantEdge ? 6 : 5} className="empty-state">No batches match.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
          <button type="button" className="secondary btn-small" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>&larr; Prev</button>
          <span className="hint">Page {page} of {totalPages} ({total} batches)</span>
          <button type="button" className="secondary btn-small" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next &rarr;</button>
        </div>
      )}
    </div>
  )
}
