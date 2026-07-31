import { Fragment, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import client from '../api/client'

function humanizeActivity(value) {
  if (!value) return '-'
  return value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function activityPillClass(value) {
  if (value === 'CONNECTED' || value === 'COMPLETED') return 'on'
  if (value === 'NO_REPLY_YET') return 'warn'
  return ''
}

// Elephant Edge only. Three-level drill-down over real SalesRobot data:
// Campaigns (docs.salesrobot.co/reference/getcampaigns) -> Leads/current status per campaign
// (.../getprospectsforcampaign) -> Activity (that lead's live status plus any historical
// webhook events we've received for them, matched by LinkedIn URL).
export default function Outcomes() {
  const { tenantSlug } = useParams()
  const [campaigns, setCampaigns] = useState([])
  const [campaignsError, setCampaignsError] = useState(null)
  const [selectedCampaign, setSelectedCampaign] = useState(null)

  const [leads, setLeads] = useState([])
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [leadsError, setLeadsError] = useState(null)

  const [activityLead, setActivityLead] = useState(null)
  const [activityEvents, setActivityEvents] = useState(null)
  const [activityError, setActivityError] = useState(null)

  const [bookings, setBookings] = useState([])
  const [expandedBookingId, setExpandedBookingId] = useState(null)

  const loadCampaigns = () => {
    client.get('/salesrobot/campaigns').then(res => setCampaigns(res.data)).catch(err => setCampaignsError(err.response?.data?.detail || err.message))
  }

  useEffect(() => {
    loadCampaigns()
    client.get('/calendar-bookings').then(res => setBookings(res.data)).catch(() => {})
  }, [])

  const openCampaign = (campaign) => {
    setSelectedCampaign(campaign)
    setActivityLead(null)
    setLeads([])
    setLeadsError(null)
    setLeadsLoading(true)
    const uuid = campaign.campaignUuid || campaign.uuid
    client.get(`/salesrobot/campaigns/${uuid}/leads`)
      .then(res => setLeads(res.data))
      .catch(err => setLeadsError(err.response?.data?.detail || err.message))
      .finally(() => setLeadsLoading(false))
  }

  const openActivity = (lead) => {
    setActivityLead(lead)
    setActivityEvents(null)
    setActivityError(null)
    if (!lead.profileUrl) {
      setActivityEvents([])
      return
    }
    client.get('/salesrobot/leads/activity', { params: { profile_url: lead.profileUrl } })
      .then(res => setActivityEvents(res.data))
      .catch(err => setActivityError(err.response?.data?.detail || err.message))
  }

  if (tenantSlug !== 'elephant-edge') {
    return (
      <div className="page">
        <div className="page-header"><h1>Campaign</h1></div>
        <p className="hint">Not available for this workspace.</p>
      </div>
    )
  }

  return (
    <div className="page page-wide">
      <div className="page-header">
        <h1>Campaign</h1>
        <p className="meta">Real campaigns, leads, and activity pulled directly from SalesRobot.</p>
      </div>
      {campaignsError && <p className="error">{campaignsError}</p>}

      <div className="batch-layout">
        <div className="batch-layout-main">
          {!selectedCampaign ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Campaign</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {campaigns.map(c => (
                    <tr key={c.campaignUuid || c.uuid}>
                      <td>{c.campaignName || c.name}</td>
                      <td>{c.campaignStatus || '-'}</td>
                      <td><button type="button" className="link-button" onClick={() => openCampaign(c)}>View leads &rarr;</button></td>
                    </tr>
                  ))}
                  {campaigns.length === 0 && !campaignsError && (
                    <tr><td colSpan={3} className="empty-state">Loading campaigns...</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <>
              <button type="button" className="link-button" style={{ marginBottom: '0.75rem' }} onClick={() => setSelectedCampaign(null)}>&larr; Back to campaigns</button>
              <h2 style={{ margin: '0 0 0.75rem' }}>{selectedCampaign.campaignName || selectedCampaign.name}</h2>
              {leadsError && <p className="error">{leadsError}</p>}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Name</th><th>Title</th><th>Company</th><th>Status</th><th></th></tr>
                  </thead>
                  <tbody>
                    {leads.map(l => (
                      <tr key={l.prospectUuid}>
                        <td>{l.fullName}</td>
                        <td>{l.jobTitle || '-'}</td>
                        <td>{l.companyName || '-'}</td>
                        <td><span className={`status-pill ${activityPillClass(l.lastActivity)}`}>{humanizeActivity(l.lastActivity)}</span></td>
                        <td><button type="button" className="link-button" onClick={() => openActivity(l)}>Activity</button></td>
                      </tr>
                    ))}
                    {leads.length === 0 && (
                      <tr><td colSpan={5} className="empty-state">{leadsLoading ? 'Loading leads...' : 'No leads in this campaign yet.'}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {activityLead && (
          <div className="message-drawer">
            <div className="message-drawer-header">
              <div>
                <h3>{activityLead.fullName}</h3>
                <p className="meta">{activityLead.jobTitle} {activityLead.companyName ? `@ ${activityLead.companyName}` : ''}</p>
              </div>
              <button type="button" className="message-drawer-close" onClick={() => setActivityLead(null)} aria-label="Close">&times;</button>
            </div>
            <div className="message-drawer-body">
              <div className="message-drawer-section">
                <strong>Current status</strong>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                  <span className={`status-pill ${activityPillClass(activityLead.lastActivity)}`}>{humanizeActivity(activityLead.lastActivity)}</span>
                </p>
              </div>
              {activityLead.profileUrl && (
                <div className="message-drawer-section">
                  <strong>Profile</strong>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}><a href={activityLead.profileUrl} target="_blank" rel="noopener noreferrer">{activityLead.profileUrl}</a></p>
                </div>
              )}
              <div className="message-drawer-section">
                <strong>History</strong>
                {activityError && <p className="error">{activityError}</p>}
                {!activityEvents && !activityError && <p className="hint">Loading...</p>}
                {activityEvents && activityEvents.length === 0 && <p className="hint">No historical events received for this lead yet.</p>}
                {activityEvents && activityEvents.map(e => (
                  <div key={e.id} style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
                    <strong>{e.event_type || 'unrecognized event'}</strong> — {new Date(e.received_at).toLocaleString()}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
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
