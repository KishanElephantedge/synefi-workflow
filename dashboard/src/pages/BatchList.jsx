import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import client from '../api/client'

export default function BatchList() {
  const [batches, setBatches] = useState([])
  const [name, setName] = useState('')
  const [newBatchSource, setNewBatchSource] = useState('deepline')
  const [sourceTab, setSourceTab] = useState('deepline')
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const { tenantSlug } = useParams()
  const isElephantEdge = tenantSlug === 'elephant-edge'

  const load = () => {
    client.get('/batches')
      .then(res => setBatches(res.data))
      .catch(err => setError(err.message))
  }

  useEffect(load, [])

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

  // Deepline and Jobo are fully independent pipelines -- never mixed in one batch -- so
  // Elephant Edge sees them as separate tabs rather than one combined list.
  const visibleBatches = isElephantEdge
    ? (batches || []).filter(b => (b.source || 'deepline') === sourceTab)
    : (batches || [])

  return (
    <div className="page">
      <div className="page-header">
        <h1>Hot Accounts</h1>
        <p className="meta">Manual runs of the pipeline, phase by phase.</p>
      </div>
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
        <div className="step-flow" style={{ marginBottom: '0.75rem' }}>
          <button
            type="button"
            className={`step-pill ${sourceTab === 'deepline' ? 'active' : ''}`}
            onClick={() => setSourceTab('deepline')}
          >
            Deepline ({(batches || []).filter(b => (b.source || 'deepline') === 'deepline').length})
          </button>
          <button
            type="button"
            className={`step-pill ${sourceTab === 'jobo' ? 'active' : ''}`}
            onClick={() => setSourceTab('jobo')}
          >
            Jobo ({(batches || []).filter(b => b.source === 'jobo').length})
          </button>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phase</th>
              <th>Status</th>
              <th>Companies</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {visibleBatches.map(b => (
              <tr key={b.id}>
                <td><Link to={`/${tenantSlug}/batches/${b.id}`}>{b.name}</Link></td>
                <td>{b.current_phase}</td>
                <td>{b.status}</td>
                <td>{b.company_count}</td>
                <td>{new Date(b.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {visibleBatches.length === 0 && (
              <tr><td colSpan={5} className="empty-state">No batches yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
