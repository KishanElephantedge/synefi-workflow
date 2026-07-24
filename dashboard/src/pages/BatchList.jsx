import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import client from '../api/client'

export default function BatchList() {
  const [batches, setBatches] = useState([])
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const navigate = useNavigate()

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
      const res = await client.post('/batches', null, { params: { name } })
      setName('')
      navigate(`/batches/${res.data.id}`)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Batches</h1>
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
          <button type="submit">Create batch</button>
        </form>
      </div>

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
            {(batches || []).map(b => (
              <tr key={b.id}>
                <td><Link to={`/batches/${b.id}`}>{b.name}</Link></td>
                <td>{b.current_phase}</td>
                <td>{b.status}</td>
                <td>{b.company_count}</td>
                <td>{new Date(b.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {batches.length === 0 && (
              <tr><td colSpan={5} className="empty-state">No batches yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
