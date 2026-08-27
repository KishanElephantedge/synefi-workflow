import { useEffect, useState } from 'react'
import { useTenant } from '../../context/TenantContext.jsx'
import { getMeetings, patchMeetingOutcome, listAccounts, getIcpsOfferings, getAccountBrief, getDetectedOutboundActivity, formatApiError } from '../api.js'
import { IconAlertTriangle, IconChevronLeft, IconChevronRight, IconEdit, IconCheck } from '../icons.jsx'

const PAGE_SIZE = 25

const STATUS_BADGE = {
  confirmed: 'v2-badge-success',
  cancelled: 'v2-badge-danger',
}

const OUTCOME_BADGE = { won: 'v2-badge-success', lost: 'v2-badge-danger' }

// Real, human-selectable outcome_channel values -- app/gtm_os/revenue/revenue_pace.py's
// OUTCOME_CHANNELS is the validated source of truth; kept in sync manually here.
const CHANNEL_OPTIONS = [
  { value: 'personal_network', label: 'Personal network' },
  { value: 'linkedin_content', label: 'LinkedIn content' },
  { value: 'inbound', label: 'Inbound (website)' },
  { value: 'webinar', label: 'Webinar' },
  { value: 'outbound', label: 'Outbound' },
  { value: 'other', label: 'Other' },
]

function formatDateTime(value) {
  if (!value) return '—'
  return new Date(value).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function FormMessage({ error }) {
  if (!error) return null
  return <div className="v2-form-message error">{error}</div>
}

// Debounced search against the EXISTING /companies?search= endpoint (already used by
// Accounts.jsx) -- no new backend search capability. Nothing here auto-resolves a booking's
// booker_email to a company; the human explicitly picks one, since no reliable email->Contact/
// Company lookup exists anywhere in the backend.
function CompanyPicker({ value, onChange }) {
  const [query, setQuery] = useState(value?.name || '')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!query.trim() || (value && query === value.name)) {
      setResults([])
      return
    }
    const timer = setTimeout(() => {
      listAccounts({ page: 1, pageSize: 8, search: query }).then(data => setResults(data.companies)).catch(() => setResults([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [query, value])

  return (
    <div className="v2-field" style={{ position: 'relative' }}>
      <label className="v2-field-label">Company</label>
      <input
        className="v2-input"
        type="text"
        placeholder="Search companies..."
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); if (value) onChange(null) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results.length > 0 && (
        <div className="v2-card" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 5, padding: '0.4rem', marginTop: 2 }}>
          {results.map(c => (
            <button
              key={c.id}
              type="button"
              className="v2-nav-item"
              style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer' }}
              onMouseDown={() => { onChange({ id: c.id, name: c.name }); setQuery(c.name); setOpen(false) }}
            >
              {c.name} {c.domain ? <span className="v2-field-hint" style={{ marginLeft: 6 }}>{c.domain}</span> : null}
            </button>
          ))}
        </div>
      )}
      {value && <div className="v2-field-hint">Linked to {value.name}</div>}
    </div>
  )
}

// Optional Opportunity link (Overrides & Evals attribution) -- only ever offers opportunities
// that actually belong to the selected company, matching the backend's own validation exactly
// (record_meeting_outcome() rejects a mismatch). Reuses the existing Account 360 brief endpoint
// rather than a new "search opportunities" capability.
function OpportunityPicker({ companyId, value, onChange }) {
  const [opportunities, setOpportunities] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!companyId) { setOpportunities([]); onChange(null); return }
    setLoading(true)
    getAccountBrief(companyId)
      .then(brief => setOpportunities(brief.opportunities || []))
      .catch(() => setOpportunities([]))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId])

  if (!companyId) return null

  return (
    <div className="v2-field">
      <label className="v2-field-label">Opportunity (optional)</label>
      {loading ? (
        <div className="v2-field-hint">Loading this account's opportunities…</div>
      ) : opportunities.length === 0 ? (
        <div className="v2-field-hint">No opportunities exist yet for this account.</div>
      ) : (
        <select className="v2-select" value={value ?? ''} onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}>
          <option value="">Not linked</option>
          {opportunities.map(o => (
            <option key={o.id} value={o.id}>{o.opportunity_statement ? o.opportunity_statement.slice(0, 80) : `Opportunity #${o.id}`}</option>
          ))}
        </select>
      )}
      <div className="v2-field-hint">Links this outcome back to the recommendation that produced it -- feeds Overrides &amp; Evals.</div>
    </div>
  )
}

function OutcomeEditForm({ booking, offerings, onSave, onCancel, saving, error }) {
  const [status, setStatus] = useState(booking.outcome_status || 'won')
  const [company, setCompany] = useState(booking.outcome_company_id ? { id: booking.outcome_company_id, name: booking.outcome_company_name || 'Linked company' } : null)
  const [offeringName, setOfferingName] = useState(booking.outcome_offering_name || '')
  const [amount, setAmount] = useState(booking.outcome_amount_usd ?? '')
  const [reason, setReason] = useState(booking.outcome_reason || '')
  const [notes, setNotes] = useState(booking.outcome_notes || '')
  const [opportunityId, setOpportunityId] = useState(booking.outcome_opportunity_id ?? null)
  const [channel, setChannel] = useState(booking.outcome_channel || '')
  const [outboundDetected, setOutboundDetected] = useState(false)

  // Real check against CampaignPush/MessageSendAttempt for this company -- a suggestion only,
  // never auto-applied to the already-set channel field. See detect_real_outbound_activity().
  useEffect(() => {
    if (!company?.id) { setOutboundDetected(false); return }
    let cancelled = false
    getDetectedOutboundActivity(company.id).then(res => {
      if (!cancelled) setOutboundDetected(!!res.detected_outbound_activity)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [company?.id])

  const canSave = status === 'won' ? true : reason.trim().length > 0

  return (
    <div style={{ marginTop: '0.8rem', paddingTop: '0.8rem', borderTop: '1px solid var(--v2-border)' }}>
      <FormMessage error={error} />
      <div className="v2-field">
        <label className="v2-field-label">Outcome</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['won', 'lost'].map(s => (
            <label key={s} className={`v2-chip-option${status === s ? ' checked' : ''}`} style={{ cursor: 'pointer' }}>
              <input type="radio" name={`outcome-${booking.id}`} checked={status === s} onChange={() => setStatus(s)} style={{ display: 'none' }} />
              {status === s && <IconCheck width={11} height={11} />}
              {s === 'won' ? 'Won' : 'Lost'}
            </label>
          ))}
        </div>
      </div>

      <CompanyPicker value={company} onChange={c => { setCompany(c); setOpportunityId(null) }} />

      <OpportunityPicker companyId={company?.id ?? null} value={opportunityId} onChange={setOpportunityId} />

      <div className="v2-field">
        <label className="v2-field-label">Offering</label>
        <select className="v2-select" value={offeringName} onChange={e => setOfferingName(e.target.value)}>
          <option value="">Not specified</option>
          {offerings.map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
        </select>
      </div>

      <div className="v2-field">
        <label className="v2-field-label">Channel</label>
        <select className="v2-select" value={channel} onChange={e => setChannel(e.target.value)}>
          <option value="">Not specified</option>
          {CHANNEL_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        {outboundDetected && channel !== 'outbound' && (
          <div className="v2-field-hint">
            A real outbound send to this company was found — likely "Outbound"?{' '}
            <button
              type="button"
              onClick={() => setChannel('outbound')}
              style={{ background: 'none', border: 'none', padding: 0, color: 'var(--v2-accent)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}
            >
              Use Outbound
            </button>
          </div>
        )}
      </div>

      {status === 'won' ? (
        <div className="v2-field">
          <label className="v2-field-label">Amount (USD)</label>
          <input className="v2-input" type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Deal value" />
        </div>
      ) : (
        <div className="v2-field">
          <label className="v2-field-label">Reason (required)</label>
          <input className="v2-input" type="text" value={reason} onChange={e => setReason(e.target.value)} placeholder="Why was this lost?" />
        </div>
      )}

      <div className="v2-field">
        <label className="v2-field-label">Summary / notes</label>
        <textarea className="v2-textarea" value={notes} onChange={e => setNotes(e.target.value)} placeholder="What happened on this call..." />
      </div>

      <div className="v2-btn-row">
        <button
          type="button"
          className="v2-btn v2-btn-primary"
          disabled={saving || !canSave}
          onClick={() => onSave({
            status,
            companyId: company?.id ?? null,
            opportunityId: opportunityId ?? null,
            offeringName: offeringName || null,
            amountUsd: status === 'won' && amount !== '' ? Number(amount) : null,
            reason: status === 'lost' ? reason : null,
            notes: notes || null,
            channel: channel || null,
          })}
        >
          {saving ? 'Saving…' : 'Save outcome'}
        </button>
        <button type="button" className="v2-btn" onClick={onCancel} disabled={saving}>Cancel</button>
        {booking.outcome_status && (
          <button
            type="button"
            className="v2-btn"
            disabled={saving}
            onClick={() => onSave({ status: null, companyId: null, opportunityId: null, offeringName: null, amountUsd: null, reason: null, notes: null, channel: null })}
          >
            Clear outcome
          </button>
        )}
      </div>
    </div>
  )
}

function BookingCard({ booking, offerings, recordedBy, onUpdated }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const save = async (payload) => {
    setSaving(true)
    setError(null)
    try {
      const updated = await patchMeetingOutcome(booking.id, { ...payload, recordedBy })
      onUpdated({ ...booking, ...updated })
      setEditing(false)
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="v2-card" style={{ marginBottom: '1rem' }}>
      <div className="v2-evidence-item-head">
        <span className="v2-evidence-item-title">{booking.booker_name || 'Unknown booker'}</span>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {booking.outcome_status && (
            <span className={`v2-badge ${OUTCOME_BADGE[booking.outcome_status]}`}>
              {booking.outcome_status === 'won'
                ? `Won${booking.outcome_amount_usd != null ? ` $${Number(booking.outcome_amount_usd).toLocaleString()}` : ''}`
                : 'Lost'}
            </span>
          )}
          <span className={`v2-badge ${STATUS_BADGE[booking.status] || 'v2-badge-neutral'}`}>
            {booking.status || 'unknown'}
          </span>
        </div>
      </div>
      <div className="v2-kv-grid" style={{ marginTop: '0.8rem' }}>
        <div>
          <div className="v2-kv-label">Start</div>
          <div className="v2-kv-value">{formatDateTime(booking.start_time)}</div>
        </div>
        <div>
          <div className="v2-kv-label">End</div>
          <div className="v2-kv-value">{formatDateTime(booking.end_time)}</div>
        </div>
        <div>
          <div className="v2-kv-label">Email</div>
          <div className="v2-kv-value" style={{ fontSize: '0.82rem' }}>{booking.booker_email || 'Not provided'}</div>
        </div>
      </div>

      {booking.outcome_status && !editing && (
        <div style={{ marginTop: '0.8rem', paddingTop: '0.8rem', borderTop: '1px solid var(--v2-border)' }}>
          {booking.outcome_channel && (
            <div style={{ marginBottom: 6 }}>
              <div className="v2-kv-label">Channel</div>
              <div className="v2-kv-value" style={{ fontSize: '0.85rem' }}>
                {CHANNEL_OPTIONS.find(c => c.value === booking.outcome_channel)?.label || booking.outcome_channel}
              </div>
            </div>
          )}
          {booking.outcome_opportunity_id && (
            <div style={{ marginBottom: 6 }}>
              <div className="v2-kv-label">Linked opportunity</div>
              <div className="v2-kv-value" style={{ fontSize: '0.85rem' }}>
                {booking.outcome_opportunity_statement
                  ? booking.outcome_opportunity_statement.slice(0, 100)
                  : `Opportunity #${booking.outcome_opportunity_id}`}
              </div>
            </div>
          )}
          {booking.outcome_status === 'lost' && booking.outcome_reason && (
            <div style={{ marginBottom: 6 }}>
              <div className="v2-kv-label">Reason</div>
              <div className="v2-kv-value" style={{ fontSize: '0.85rem' }}>{booking.outcome_reason}</div>
            </div>
          )}
          {booking.outcome_notes && (
            <div>
              <div className="v2-kv-label">Notes</div>
              <div className="v2-evidence-item-body">{booking.outcome_notes}</div>
            </div>
          )}
        </div>
      )}

      {editing ? (
        <OutcomeEditForm booking={booking} offerings={offerings} onSave={save} onCancel={() => { setEditing(false); setError(null) }} saving={saving} error={error} />
      ) : (
        <div style={{ marginTop: '0.8rem' }}>
          <button type="button" className="v2-btn" onClick={() => setEditing(true)}>
            <IconEdit width={13} height={13} /> {booking.outcome_status ? 'Edit outcome' : 'Mark outcome'}
          </button>
        </div>
      )}
    </div>
  )
}

// Real feature, not new: same CalendarBooking data (Google Calendar Appointment Schedule sync)
// V1's Meetings.jsx already shows, through the same unmodified GET /calendar-bookings route.
// Outcome recording (won/lost + amount/reason + a free-text summary) is new: PATCH
// /calendar-bookings/{id}/outcome, human-supplied, feeding Revenue Pace. There is still no
// automatic linkage between a booking and a Company/Contact -- booker_name/booker_email remain
// free text; linking to a company for outcome purposes is an explicit human choice via the
// company picker below, not an automatic match.
export default function Meetings() {
  const { user } = useTenant()
  const [bookings, setBookings] = useState([])
  const [offerings, setOfferings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  useEffect(() => {
    getIcpsOfferings().then(data => setOfferings(data.offerings || [])).catch(() => setOfferings([]))
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      setSearch(searchInput)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getMeetings({ page, pageSize: PAGE_SIZE, search })
      .then(data => {
        if (cancelled) return
        setBookings(data.bookings)
        setTotal(data.total)
        setTotalPages(data.total_pages)
      })
      .catch(err => {
        if (cancelled) return
        setError(formatApiError(err))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [page, search])

  const updateBooking = (updated) => {
    setBookings(prev => prev.map(b => (b.id === updated.id ? updated : b)))
  }

  return (
    <div>

      <div className="v2-toolbar">
        <input
          type="text"
          className="v2-search-input"
          placeholder="Search name or email..."
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
        />
      </div>

      {error ? (
        <div className="v2-card">
          <div className="v2-state v2-state-error">
            <IconAlertTriangle width={20} height={20} style={{ marginBottom: 8 }} />
            <div>Couldn't load meetings: {error}</div>
          </div>
        </div>
      ) : loading ? (
        <div className="v2-account-list">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="v2-skeleton-row" style={{ height: 120 }} />)}
        </div>
      ) : bookings.length === 0 ? (
        <div className="v2-card">
          <div className="v2-state">
            {search ? `No meetings match "${search}".` : 'No calendar bookings have synced yet.'}
          </div>
        </div>
      ) : (
        <>
          {bookings.map(b => (
            <BookingCard key={b.id} booking={b} offerings={offerings} recordedBy={user?.email} onUpdated={updateBooking} />
          ))}
          {totalPages > 1 && (
            <div className="v2-pagination">
              <button type="button" onClick={() => setPage(p => p - 1)} disabled={page <= 1} aria-label="Previous page">
                <IconChevronLeft width={14} height={14} />
              </button>
              <span>Page {page} of {totalPages} · {total} meetings</span>
              <button type="button" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} aria-label="Next page">
                <IconChevronRight width={14} height={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
