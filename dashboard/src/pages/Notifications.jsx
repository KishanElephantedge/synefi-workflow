import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import client from '../api/client'

const SEVERITY_LABEL = {
  error: { color: '#ef4444', bg: '#fee2e2', text: 'Error' },
  warning: { color: '#f59e0b', bg: '#fef3c7', text: 'Warning' },
  success: { color: '#10b981', bg: '#d1fae5', text: 'Success' },
  info: { color: '#6366f1', bg: '#eef2ff', text: 'Info' },
}

function timeAgo(iso) {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

const PAGE_SIZE = 20

export default function Notifications() {
  const { tenantSlug } = useParams()
  const navigate = useNavigate()

  const [notifications, setNotifications] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [page, setPage] = useState(1)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = () => {
    setLoading(true)
    client.get('/notifications', { params: { page, page_size: PAGE_SIZE, unread_only: unreadOnly } })
      .then(res => {
        setNotifications(res.data.notifications)
        setTotal(res.data.total)
        setTotalPages(res.data.total_pages)
        setUnreadCount(res.data.unread_count)
        setSelected(new Set())
      })
      .catch(err => setError(err.response?.data?.detail || err.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [page, unreadOnly])

  if (tenantSlug !== 'elephant-edge') {
    return (
      <div className="page">
        <div className="page-header"><h1>Notifications</h1></div>
        <p className="hint">Not available for this workspace.</p>
      </div>
    )
  }

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selected.size === notifications.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(notifications.map(n => n.id)))
    }
  }

  const markSelectedRead = async () => {
    await Promise.all([...selected].map(id => client.post(`/notifications/${id}/read`)))
    load()
  }

  const markAllRead = async () => {
    await client.post('/notifications/read-all')
    load()
  }

  const deleteSelected = async () => {
    if (selected.size === 0) return
    if (!window.confirm(`Delete ${selected.size} notification(s)? This can't be undone.`)) return
    await client.post('/notifications/bulk-delete', { ids: [...selected] })
    load()
  }

  const openRelated = (n) => {
    if (!n.read) client.post(`/notifications/${n.id}/read`).then(load).catch(() => {})
    if (n.batch_id) navigate(`/${tenantSlug}/batches/${n.batch_id}`)
  }

  return (
    <div className="page page-wide">
      {error && <p className="error">{error}</p>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className={!unreadOnly ? '' : 'secondary'} onClick={() => { setPage(1); setUnreadOnly(false) }}>All</button>
          <button type="button" className={unreadOnly ? '' : 'secondary'} onClick={() => { setPage(1); setUnreadOnly(true) }}>Unread{unreadCount > 0 ? ` (${unreadCount})` : ''}</button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="secondary btn-small" disabled={selected.size === 0} onClick={markSelectedRead}>Mark selected as read</button>
          <button type="button" className="secondary btn-small" disabled={unreadCount === 0} onClick={markAllRead}>Mark all as read</button>
          <button type="button" className="danger btn-small" disabled={selected.size === 0} onClick={deleteSelected}>Delete selected</button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: '2.5rem' }}>
                <input type="checkbox" checked={notifications.length > 0 && selected.size === notifications.length} onChange={toggleSelectAll} />
              </th>
              <th>Severity</th>
              <th>Title</th>
              <th>Message</th>
              <th>When</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {notifications.map(n => {
              const meta = SEVERITY_LABEL[n.severity] || SEVERITY_LABEL.info
              return (
                <tr key={n.id} style={{ background: n.read ? 'transparent' : 'var(--surface-alt)' }}>
                  <td onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(n.id)} onChange={() => toggleSelect(n.id)} />
                  </td>
                  <td><span className="status-pill-sm" style={{ background: meta.bg, color: meta.color, padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 }}>{meta.text}</span></td>
                  <td style={{ cursor: 'pointer', fontWeight: n.read ? 400 : 700 }} onClick={() => openRelated(n)}>{n.title}</td>
                  <td style={{ maxWidth: '360px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{n.message}</td>
                  <td className="hint">{timeAgo(n.created_at)}</td>
                  <td>
                    {!n.read && (
                      <button type="button" className="link-button" onClick={(e) => { e.stopPropagation(); client.post(`/notifications/${n.id}/read`).then(load) }}>
                        Mark read
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {notifications.length === 0 && (
              <tr><td colSpan={6} className="empty-state">{loading ? 'Loading...' : 'No notifications.'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem' }}>
          <button type="button" className="secondary btn-small" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>&larr; Prev</button>
          <span className="hint">Page {page} of {totalPages} ({total} notifications)</span>
          <button type="button" className="secondary btn-small" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next &rarr;</button>
        </div>
      )}
      <p className="hint" style={{ marginTop: '1rem' }}>Notifications older than 30 days are removed automatically.</p>
    </div>
  )
}
