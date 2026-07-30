import { Fragment, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import client from '../api/client'

// Elephant Edge only -- outcome events (connection accepted, reply, etc.) received via
// SalesRobot's outbound webhook. Confirmed live: SalesRobot pushes events to us, there is no
// pull/status API to poll instead, so this is purely a viewer over what's already landed --
// nothing here triggers a fetch from SalesRobot itself.
export default function Outcomes() {
  const { tenantSlug } = useParams()
  const [events, setEvents] = useState([])
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [bookings, setBookings] = useState([])
  const [expandedBookingId, setExpandedBookingId] = useState(null)

  const load = () => {
    client.get('/campaign-events').then(res => setEvents(res.data)).catch(err => setError(err.message))
    client.get('/calendar-bookings').then(res => setBookings(res.data)).catch(err => setError(err.message))
  }

  useEffect(load, [])

  if (tenantSlug !== 'elephant-edge') {
    return (
      <div className="page">
        <div className="page-header"><h1>Campaign</h1></div>
        <p className="hint">Not available for this workspace.</p>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Campaign</h1>
        <p className="meta">Connection accepts, replies, and other campaign events received live from SalesRobot -- this list updates automatically as new events arrive, no manual fetch needed.</p>
      </div>
      {error && <p className="error">{error}</p>}

      <div className="inline-form">
        <button type="button" className="secondary" onClick={load}>Refresh</button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Received</th>
              <th>Event</th>
              <th>Contact</th>
              <th>Company</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {events.map(e => (
              <Fragment key={e.id}>
                <tr>
                  <td>{new Date(e.received_at).toLocaleString()}</td>
                  <td>{e.event_type || <span className="hint">unrecognized -- see raw payload</span>}</td>
                  <td>{e.contact_name || <span className="hint">not matched</span>}</td>
                  <td>{e.company_name || '-'}</td>
                  <td>
                    <button type="button" className="link-button" onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}>
                      {expandedId === e.id ? 'Hide' : 'Raw payload'}
                    </button>
                  </td>
                </tr>
                {expandedId === e.id && (
                  <tr>
                    <td colSpan={5} style={{ background: '#f8f9fa' }}>
                      <pre style={{ fontSize: '0.78rem', maxHeight: '300px', overflow: 'auto' }}>{JSON.stringify(e.raw_payload, null, 2)}</pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {events.length === 0 && (
              <tr><td colSpan={5} className="empty-state">No events received yet. New accepts/replies on connected campaigns will appear here automatically.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="page-header" style={{ marginTop: '2rem' }}>
        <h1 style={{ fontSize: '1.4rem' }}>Calendar bookings</h1>
        <p className="meta">Calls booked through the Google Calendar Appointment Schedule -- synced every 15 minutes automatically (needs Google Calendar credentials in Settings first).</p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Start</th>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bookings.map(b => (
              <Fragment key={b.id}>
                <tr>
                  <td>{b.start_time ? new Date(b.start_time).toLocaleString() : '-'}</td>
                  <td>{b.booker_name || <span className="hint">unknown</span>}</td>
                  <td>{b.booker_email || '-'}</td>
                  <td>{b.status || '-'}</td>
                  <td>
                    <button type="button" className="link-button" onClick={() => setExpandedBookingId(expandedBookingId === b.id ? null : b.id)}>
                      {expandedBookingId === b.id ? 'Hide' : 'Raw payload'}
                    </button>
                  </td>
                </tr>
                {expandedBookingId === b.id && (
                  <tr>
                    <td colSpan={5} style={{ background: '#f8f9fa' }}>
                      <pre style={{ fontSize: '0.78rem', maxHeight: '300px', overflow: 'auto' }}>{JSON.stringify(b.raw_payload, null, 2)}</pre>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {bookings.length === 0 && (
              <tr><td colSpan={5} className="empty-state">No bookings synced yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
