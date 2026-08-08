import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import client from '../api/client'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

// Async, cross-timezone review layer -- click a day, see everything that happened (batches/
// companies/decision-makers/messages), leave an approve/reject verdict and comments for
// whoever else looks at it later. Deliberately disconnected from the real pipeline -- this
// never touches message approval or pushes, it's a human tracking layer on top.
export default function Calendar() {
  const { tenantSlug } = useParams()
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [days, setDays] = useState([])
  const [selectedDate, setSelectedDate] = useState(null)
  const [dayDetail, setDayDetail] = useState(null)
  const [loadingDay, setLoadingDay] = useState(false)
  const [tab, setTab] = useState('activity')
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

  const loadDay = (dateStr) => {
    setSelectedDate(dateStr)
    setTab('activity')
    setLoadingDay(true)
    client.get(`/calendar/${dateStr}`).then(res => setDayDetail(res.data)).finally(() => setLoadingDay(false))
  }

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) } else { setMonth(m => m - 1) }
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) } else { setMonth(m => m + 1) }
  }

  const setReview = (status) => {
    client.post(`/calendar/${selectedDate}/review`, { status }).then(() => {
      loadDay(selectedDate)
      loadMonth()
    })
  }

  const addComment = () => {
    const text = commentText.trim()
    if (!text) return
    client.post(`/calendar/${selectedDate}/comments`, { comment: text }).then(() => {
      setCommentText('')
      loadDay(selectedDate)
      loadMonth()
    })
  }

  const deleteComment = (id) => {
    client.delete(`/calendar/${selectedDate}/comments/${id}`).then(() => {
      loadDay(selectedDate)
      loadMonth()
    })
  }

  const cells = buildMonthGrid(year, month)
  const todayStr = todayDateString()

  return (
    <div className="page page-wide">
      <div className="calendar-layout">
        <div className="calendar-grid-panel">
          <div className="calendar-month-nav">
            <button type="button" className="secondary btn-small" onClick={prevMonth}>&larr;</button>
            <strong>{MONTH_NAMES[month - 1]} {year}</strong>
            <button type="button" className="secondary btn-small" onClick={nextMonth}>&rarr;</button>
          </div>
          <div className="calendar-weekday-row">
            {WEEKDAY_LABELS.map(w => <div key={w} className="calendar-weekday">{w}</div>)}
          </div>
          <div className="calendar-grid">
            {cells.map((d, i) => {
              if (d === null) return <div key={`blank-${i}`} className="calendar-cell calendar-cell-blank" />
              const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
              const info = dayByDate[dateStr]
              const status = info?.status || 'pending'
              const hasActivity = info?.has_activity
              const classes = ['calendar-cell']
              if (hasActivity) classes.push(`calendar-cell-${status}`)
              if (dateStr === todayStr) classes.push('calendar-cell-today')
              if (dateStr === selectedDate) classes.push('calendar-cell-selected')
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

        <div className="calendar-detail-panel">
          {!selectedDate && <p className="hint">Click a day to see that day's activity.</p>}
          {selectedDate && loadingDay && <p className="hint">Loading...</p>}
          {selectedDate && !loadingDay && dayDetail && (
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

              <div className="calendar-detail-tabs">
                <button type="button" className={tab === 'activity' ? '' : 'secondary'} onClick={() => setTab('activity')}>Activity</button>
                <button type="button" className={tab === 'comments' ? '' : 'secondary'} onClick={() => setTab('comments')}>
                  Comments{dayDetail.comments.length > 0 ? ` (${dayDetail.comments.length})` : ''}
                </button>
              </div>

              {tab === 'activity' && (
                <div className="calendar-activity-list">
                  {dayDetail.batches.length === 0 && <p className="hint">No batches ran this day.</p>}
                  {dayDetail.batches.map(b => (
                    <div key={b.id} className="calendar-batch-card">
                      <div className="calendar-batch-card-header">
                        <strong>{b.name}</strong>
                        <span className="hint">{b.source} &middot; {b.current_phase}</span>
                      </div>
                      {b.companies.length === 0 && <p className="hint">No companies yet.</p>}
                      {b.companies.map(c => (
                        <div key={c.id} className="calendar-company-row">
                          <div className="calendar-company-row-head">
                            <span>{c.name}</span>
                            {c.qualified && <span className="calendar-qualified-badge">Qualified</span>}
                          </div>
                          {c.contacts.map(ct => (
                            <div key={ct.id} className="calendar-contact-row">
                              <div className="hint">{ct.name || 'Unnamed'} &middot; {ct.title || 'No title'}</div>
                              {ct.generated_message && (
                                <div className="calendar-message-preview">{ct.generated_message}</div>
                              )}
                              {!ct.generated_message && <div className="hint">No message drafted yet.</div>}
                            </div>
                          ))}
                          {c.contacts.length === 0 && <div className="hint">No decision-maker found.</div>}
                        </div>
                      ))}
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
                        <button type="button" className="link-button" onClick={() => deleteComment(c.id)}>Delete</button>
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
      </div>
    </div>
  )
}
