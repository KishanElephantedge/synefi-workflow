import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import client from '../api/client'

// Calendar bookings, as their own page -- previously a small inline table at the bottom of
// the Campaign page with no search/pagination. Same data (Google Calendar Appointment
// Schedule sync), now a real list.
export default function Meetings() {
  const { tenantSlug } = useParams()

  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
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
    client.get('/calendar-bookings', { params: { page, page_size: PAGE_SIZE, search } })
      .then(res => {
        setBookings(res.data.bookings)
        setTotalPages(res.data.total_pages)
        setTotal(res.data.total)
      })
      .catch(err => setError(err.response?.data?.detail || err.message))
      .finally(() => setLoading(false))
  }, [tenantSlug, page, search])

  if (tenantSlug !== 'elephant-edge') {
    return (
      <div className="page">
        <div className="page-header"><h1>Meetings</h1></div>
        <p className="hint">Not available for this workspace.</p>
      </div>
    )
  }

  return (
    <div className="page page-wide">
      <div className="page-header">
        <h1>Meetings</h1>
        <p className="meta">Calls booked through the Google Calendar Appointment Schedule.</p>
      </div>

      <input
        type="text"
        placeholder="Search name or email..."
        value={searchInput}
        onChange={e => setSearchInput(e.target.value)}
        style={{ width: '100%', maxWidth: '360px', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '0.75rem' }}
      />

      {error && <p className="error">{error}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Start</th><th>Name</th><th>Email</th><th>Status</th></tr></thead>
          <tbody>
            {bookings.map(b => (
              <tr key={b.id}>
                <td>{b.start_time ? new Date(b.start_time).toLocaleString() : '-'}</td>
                <td>{b.booker_name || <span className="hint">unknown</span>}</td>
                <td>{b.booker_email || '-'}</td>
                <td>{b.status || '-'}</td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr><td colSpan={4} className="empty-state">{loading ? 'Loading...' : 'No bookings match.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
          <button type="button" className="secondary btn-small" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>&larr; Prev</button>
          <span className="hint">Page {page} of {totalPages} ({total} meetings)</span>
          <button type="button" className="secondary btn-small" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next &rarr;</button>
        </div>
      )}
    </div>
  )
}
