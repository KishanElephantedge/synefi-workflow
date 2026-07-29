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

  const load = () => {
    client.get('/campaign-events').then(res => setEvents(res.data)).catch(err => setError(err.message))
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
    </div>
  )
}
