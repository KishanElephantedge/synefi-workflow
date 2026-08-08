import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import client from '../api/client'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const TIMELINE_ICON = {
  discovery: '🔍',
  decision_maker: '🧑',
  message: '✉️',
}

function todayDateString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildMonthGrid(year, month) {
  const firstWeekday = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const cells = []
  for (let i = 0; i < firstWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  return cells
}

function timeAgo(iso) {
  if (!iso) return ''
  // Backend timestamps are naive UTC -- a string with no "Z"/offset gets parsed as LOCAL time
  // by JS, silently shifting it by the browser's UTC offset. Treat offset-less strings as UTC.
  const normalized = /[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`
  const diffMs = Date.now() - new Date(normalized).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function formatClock(iso) {
  const normalized = /[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`
  return new Date(normalized).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function LinkedInIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67h-3.56V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45z"/></svg>
  )
}

// Async, cross-timezone review layer -- click a day, see everything that happened (companies/
// decision-makers/messages), leave an approve/reject verdict and comments for whoever looks
// at it later. Deliberately disconnected from the real pipeline -- never touches message
// approval or pushes, it's a human tracking layer on top.
export default function Calendar() {
  const { tenantSlug } = useParams()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [days, setDays] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [dayDetail, setDayDetail] = useState(null)
  const [loadingDay, setLoadingDay] = useState(false)
  const [tab, setTab] = useState('timeline')
  const [commentText, setCommentText] = useState('')

  const loadMonth = () => {
    client.get('/calendar/month', { params: { year, month } }).then(res => setDays(res.data.days)).catch(() => {})
  }

  useEffect(() => {
    if (tenantSlug === 'elephant-edge') loadMonth()
  }, [tenantSlug, year, month])

  if (tenantSlug !== 'elephant-edge') {
    return <div className="page"><p className="hint">Not available for this workspace.</p></div>
  }

  const dayByDate = Object.fromEntries(days.map(d => [d.date, d]))

  // refreshDay re-fetches without touching the active tab -- loadDay is only for the initial
  // navigation into a day (where defaulting to Activity makes sense). Found live: reusing
  // loadDay as the post-action refresh silently kicked the user back to Activity every time
  // they approved/rejected or added a comment while on the Comments tab.
  const refreshDay = (dateStr) => {
    setLoadingDay(true)
    client.get(`/calendar/${dateStr}`).then(res => setDayDetail(res.data)).finally(() => setLoadingDay(false))
  }

  const loadDay = (dateStr) => {
    setSelectedDate(dateStr)
    setTab('timeline')
    refreshDay(dateStr)
  }

  const backToCalendar = () => {
    setSelectedDate(null)
    setDayDetail(null)
  }

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) } else { setMonth(m => m - 1) }
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) } else { setMonth(m => m + 1) }
  }

  const setReview = (status) => {
    client.post(`/calendar/${selectedDate}/review`, { status }).then(() => {
      refreshDay(selectedDate)
      loadMonth()
    })
  }

  const addComment = () => {
    const text = commentText.trim()
    if (!text) return
    client.post(`/calendar/${selectedDate}/comments`, { comment: text }).then(() => {
      setCommentText('')
      refreshDay(selectedDate)
      loadMonth()
    })
  }

  const deleteComment = (id) => {
    client.delete(`/calendar/${selectedDate}/comments/${id}`).then(() => {
      refreshDay(selectedDate)
      loadMonth()
    })
  }

  const cells = buildMonthGrid(year, month)
  const todayStr = todayDateString()

  // ---- Calendar-only view ----
  if (!selectedDate) {
    return (
      <div className="page page-wide">
        <div className="calendar-solo-panel">
          <div className="calendar-month-nav">
            <button type="button" className="secondary btn-small" onClick={prevMonth}>&larr;</button>
            <strong>{MONTH_NAMES[month - 1]} {year}</strong>
            <button type="button" className="secondary btn-small" onClick={nextMonth}>&rarr;</button>
          </div>
          <div className="calendar-weekday-row calendar-weekday-row-lg">
            {WEEKDAY_LABELS.map(w => <div key={w} className="calendar-weekday">{w}</div>)}
          </div>
          <div className="calendar-grid calendar-grid-lg">
            {cells.map((d, i) => {
              if (d === null) return <div key={`blank-${i}`} className="calendar-cell calendar-cell-blank" />
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
              const info = dayByDate[dateStr]
              const status = info?.status || 'pending'
              const hasActivity = info?.has_activity
              const classes = ['calendar-cell', 'calendar-cell-lg']
              if (hasActivity) classes.push(`calendar-cell-${status}`)
              if (dateStr === todayStr) classes.push('calendar-cell-today')
              return (
                <button type="button" key={dateStr} className={classes.join(' ')} onClick={() => loadDay(dateStr)}>
                  <span className="calendar-cell-num">{d}</span>
                  {info?.comment_count > 0 && <span className="calendar-cell-comment-dot" title={`${info.comment_count} comment(s)`} />}
                </button>
              )
            })}
          </div>
          <div className="calendar-legend">
            <span><i className="calendar-legend-dot calendar-cell-approved" /> Approved</span>
            <span><i className="calendar-legend-dot calendar-cell-rejected" /> Rejected</span>
            <span><i className="calendar-legend-dot calendar-cell-pending" /> Unreviewed</span>
          </div>
        </div>
      </div>
    )
  }

  // ---- Day detail view ----
  return (
    <div className="page page-wide">
      <button type="button" className="link-button calendar-back-link" onClick={backToCalendar}>&larr; Back to calendar</button>

      {loadingDay && <p className="hint">Loading...</p>}
      {!loadingDay && dayDetail && (
        <>
          <div className="calendar-detail-header">
            <h2>{selectedDate}</h2>
            <div className="calendar-detail-actions">
              <button type="button" className={`btn-small ${dayDetail.status === 'approved' ? 'btn-approve active' : 'btn-approve'}`} onClick={() => setReview('approved')}>Approve</button>
              <button type="button" className={`btn-small ${dayDetail.status === 'rejected' ? 'btn-reject active' : 'btn-reject'}`} onClick={() => setReview('rejected')}>Reject</button>
              {dayDetail.status !== 'pending' && (
                <button type="button" className="secondary btn-small" onClick={() => setReview('pending')}>Clear</button>
              )}
            </div>
          </div>

          <div className="calendar-stat-row">
            <div className="calendar-stat-card">
              <div className="calendar-stat-num">{dayDetail.summary.companies_discovered}</div>
              <div className="calendar-stat-label">Companies Discovered</div>
            </div>
            <div className="calendar-stat-card">
              <div className="calendar-stat-num">{dayDetail.summary.companies_qualified}</div>
              <div className="calendar-stat-label">Companies Qualified</div>
            </div>
            <div className="calendar-stat-card">
              <div className="calendar-stat-num">{dayDetail.summary.decision_makers_found}</div>
              <div className="calendar-stat-label">Decision-Makers Found</div>
            </div>
          </div>

          {dayDetail.batch_names.length > 0 && (
            <p className="hint calendar-batch-tags">Batches: {dayDetail.batch_names.join(', ')}</p>
          )}

          <div className="calendar-detail-tabs">
            <button type="button" className={tab === 'timeline' ? '' : 'secondary'} onClick={() => setTab('timeline')}>Timeline</button>
            <button type="button" className={tab === 'companies' ? '' : 'secondary'} onClick={() => setTab('companies')}>
              Companies{dayDetail.companies.length > 0 ? ` (${dayDetail.companies.length})` : ''}
            </button>
            <button type="button" className={tab === 'decision-makers' ? '' : 'secondary'} onClick={() => setTab('decision-makers')}>
              Decision-Makers{dayDetail.decision_makers.length > 0 ? ` (${dayDetail.decision_makers.length})` : ''}
            </button>
            <button type="button" className={tab === 'comments' ? '' : 'secondary'} onClick={() => setTab('comments')}>
              Comments{dayDetail.comments.length > 0 ? ` (${dayDetail.comments.length})` : ''}
            </button>
          </div>

          {tab === 'timeline' && (
            <div className="calendar-timeline">
              {dayDetail.timeline.length === 0 && <p className="hint">No activity this day.</p>}
              {dayDetail.timeline.map((item, i) => (
                <div key={i} className="calendar-timeline-item">
                  <span className="calendar-timeline-icon">{TIMELINE_ICON[item.type] || '•'}</span>
                  <div className="calendar-timeline-body">
                    <span>{item.text}</span>
                    <span className="hint calendar-timeline-time">{formatClock(item.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'companies' && (
            <div className="calendar-company-list">
              {dayDetail.companies.length === 0 && <p className="hint">No companies this day.</p>}
              {dayDetail.companies.map(c => (
                <div key={c.id} className="calendar-company-card">
                  <div className="calendar-company-card-main">
                    <span className="calendar-company-card-name">{c.name}</span>
                    {c.qualified && <span className="calendar-qualified-badge">Qualified</span>}
                    <span className="hint">{c.contact_count} contact{c.contact_count === 1 ? '' : 's'}</span>
                  </div>
                  {c.linkedin_url && (
                    <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="calendar-linkedin-link" title="View on LinkedIn">
                      <LinkedInIcon /> LinkedIn
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'decision-makers' && (
            <div className="calendar-dm-list">
              {dayDetail.decision_makers.length === 0 && <p className="hint">No decision-makers found this day.</p>}
              {dayDetail.decision_makers.map(dm => (
                <div key={dm.contact_id} className="calendar-dm-card">
                  <div className="calendar-dm-head">
                    <div className="calendar-dm-head-main">
                      <strong>{dm.name || 'Unnamed'}</strong>
                      <span className="hint">{dm.title || 'No title'} &middot; {dm.company_name}</span>
                    </div>
                    {dm.message_status && <span className={`calendar-msg-status calendar-msg-status-${dm.message_status}`}>{dm.message_status}</span>}
                  </div>
                  {dm.linkedin_url && (
                    <a href={dm.linkedin_url} target="_blank" rel="noreferrer" className="calendar-linkedin-link" title="View on LinkedIn">
                      <LinkedInIcon /> LinkedIn
                    </a>
                  )}
                  {dm.generated_message
                    ? <div className="calendar-message-preview">{dm.generated_message}</div>
                    : <div className="hint calendar-dm-no-message">No message drafted yet.</div>}
                </div>
              ))}
            </div>
          )}

          {tab === 'comments' && (
            <div className="calendar-comments">
              {dayDetail.comments.length === 0 && <p className="hint">No comments yet.</p>}
              {dayDetail.comments.map(c => (
                <div key={c.id} className="calendar-comment">
                  <div className="calendar-comment-text">{c.comment}</div>
                  <div className="calendar-comment-meta">
                    <span className="hint">{timeAgo(c.created_at)}</span>
                    <button type="button" className="icon-button" title="Delete comment" onClick={() => deleteComment(c.id)}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m5 0V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </div>
              ))}
              <div className="calendar-comment-input-row">
                <textarea
                  rows={2}
                  placeholder="@name your comment..."
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                />
                <button type="button" onClick={addComment} disabled={!commentText.trim()}>Add</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
