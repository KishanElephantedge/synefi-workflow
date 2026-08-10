import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import client from '../api/client'

const POLL_INTERVAL_MS = 60000
const DROPDOWN_LIMIT = 6

const SEVERITY_DOT = {
  error: '#ef4444',
  warning: '#f59e0b',
  success: '#10b981',
  info: '#6366f1',
}

function timeAgo(iso) {
  if (!iso) return ''
  // Backend timestamps are naive UTC -- a string with no "Z"/offset gets parsed as LOCAL time
  // by JS, silently shifting it by the browser's UTC offset (found live: a fresh notification
  // showing hours old). Treat any offset-less ISO string as UTC.
  const normalized = /[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`
  const diffMs = Date.now() - new Date(normalized).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

// Bell icon + unread badge in the top header. Deliberately shows only the latest few
// notifications in a fixed-size dropdown -- no infinite scroll or tabs here, that's what the
// full /notifications page (via "View all") is for.
export default function NotificationBell() {
  const { tenantSlug } = useParams()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef(null)

  const load = () => {
    client.get('/notifications', { params: { page: 1, page_size: DROPDOWN_LIMIT } })
      .then(res => {
        setNotifications(res.data.notifications)
        setUnreadCount(res.data.unread_count)
      })
      .catch(() => {})
  }

  useEffect(() => {
    if (tenantSlug !== 'elephant-edge') return
    load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [tenantSlug])

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (tenantSlug !== 'elephant-edge') return null

  const markRead = (id, e) => {
    e.stopPropagation()
    client.post(`/notifications/${id}/read`).then(load).catch(() => {})
  }

  const openFull = () => {
    setOpen(false)
    navigate(`/${tenantSlug}/notifications`)
  }

  return (
    <div className="notification-bell-wrap" ref={dropdownRef}>
      <button type="button" className="notification-bell-btn" onClick={() => setOpen(o => !o)} aria-label="Notifications">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <strong>Notifications</strong>
            {unreadCount > 0 && <span className="hint">{unreadCount} unread</span>}
          </div>
          <div className="notification-dropdown-list">
            {notifications.length === 0 && <p className="hint" style={{ padding: '1rem' }}>No notifications yet.</p>}
            {notifications.map(n => (
              <div key={n.id} className={`notification-item ${n.read ? '' : 'unread'}`} onClick={(e) => markRead(n.id, e)}>
                <span className="notification-dot" style={{ background: SEVERITY_DOT[n.severity] || SEVERITY_DOT.info }} />
                <div className="notification-item-body">
                  <div className="notification-item-title">{n.title}</div>
                  {n.message && <div className="notification-item-message">{n.message}</div>}
                  <div className="notification-item-time">{timeAgo(n.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="notification-view-all" onClick={openFull}>View all</button>
        </div>
      )}
    </div>
  )
}
