import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getEmailCampaignDetail, getEmailCampaignLeads, formatApiError } from '../v2/api.js'

// Real Smartlead campaign detail (2026-10-05). open_count/click_count are shown only when
// tracking was actually on for this campaign (open_tracking_enabled/click_tracking_enabled) --
// both Fractional Partner campaigns have tracking OFF, so showing "0 opens" there would read as
// "nobody opened" when the true answer is "we don't know, tracking was off". The leads table is
// fetched on demand (same pattern as the webinar recipients drill-down) since the aggregate
// stats answer "how many" cheaply; the itemized list is heavier and only needed on request.

function StatCard({ value, label }) {
  return (
    <div className="partnerStatCard">
      <div className="partnerStatCardValue">{value}</div>
      <div className="partnerStatCardLabel">{label}</div>
    </div>
  )
}

export default function PartnerEmailCampaignDetail({ basePath }) {
  const { campaignId } = useParams()
  const [campaign, setCampaign] = useState(null)
  const [error, setError] = useState(null)
  const [showLeads, setShowLeads] = useState(false)
  const [leads, setLeads] = useState(null)
  const [leadsLoading, setLeadsLoading] = useState(false)

  useEffect(() => {
    getEmailCampaignDetail(campaignId).then(setCampaign).catch(e => setError(formatApiError(e)))
  }, [campaignId])

  const toggleLeads = () => {
    if (showLeads) { setShowLeads(false); return }
    setShowLeads(true)
    setLeadsLoading(true)
    getEmailCampaignLeads(campaignId)
      .then(d => setLeads(d.leads))
      .catch(e => setError(formatApiError(e)))
      .finally(() => setLeadsLoading(false))
  }

  if (error) return <div className="partnerMain"><p className="partnerEmptyFeatures">{error}</p></div>
  if (!campaign) return <div className="partnerMain"><p className="partnerEmptyFeatures">Loading...</p></div>

  return (
    <div>
      <Link to={`${basePath}/email-campaigns`} className="partnerBackLink">&larr; Email</Link>

      <div className="partnerDetailHeader">
        <h1>{campaign.label}</h1>
        <div className="partnerDetailMetaRow">
          <span className="partnerTag">{campaign.status}</span>
        </div>
      </div>

      <h3 style={{ marginBottom: '0.5rem' }}>Live stats</h3>
      <div className="partnerStatsRow">
        <StatCard value={campaign.sent_count} label="Emails sent" />
        <StatCard value={campaign.unique_sent_count} label="People reached" />
        <StatCard value={campaign.reply_count} label="Replies" />
        <StatCard value={campaign.bounce_count} label="Bounces" />
        <StatCard value={campaign.unsubscribed_count} label="Unsubscribed" />
      </div>

      <div className="partnerStatsRow" style={{ marginTop: '0.75rem' }}>
        {campaign.open_tracking_enabled ? (
          <StatCard value={campaign.open_count} label="Opens" />
        ) : (
          <div className="partnerStatCard">
            <div className="partnerStatCardValue" style={{ opacity: 0.5 }}>--</div>
            <div className="partnerStatCardLabel">Opens (tracking was off for this campaign)</div>
          </div>
        )}
        {campaign.click_tracking_enabled ? (
          <StatCard value={campaign.click_count} label="Link clicks" />
        ) : (
          <div className="partnerStatCard">
            <div className="partnerStatCardValue" style={{ opacity: 0.5 }}>--</div>
            <div className="partnerStatCardLabel">Link clicks (tracking was off for this campaign)</div>
          </div>
        )}
      </div>

      {Array.isArray(campaign.sequences) && campaign.sequences.length > 0 && (
        <>
          <h3 style={{ margin: '1.5rem 0 0.5rem' }}>What was sent</h3>
          {campaign.sequences.map(seq => (
            <div key={seq.seq_number} className="partnerFact" style={{ marginBottom: '0.75rem' }}>
              <span>Step {seq.seq_number}{seq.subject ? ` -- ${seq.subject}` : ''}</span>
              <div
                style={{ fontSize: '0.9rem', lineHeight: 1.5, maxWidth: '640px' }}
                dangerouslySetInnerHTML={{ __html: seq.email_body || '' }}
              />
            </div>
          ))}
        </>
      )}

      <div style={{ marginTop: '1.5rem' }}>
        <button type="button" className="btn-small" onClick={toggleLeads}>
          {showLeads ? 'Hide recipient list' : `Show recipient list (${campaign.unique_sent_count})`}
        </button>
      </div>

      {showLeads && (
        <div className="partnerTableWrap" style={{ marginTop: '1rem' }}>
          {leadsLoading ? (
            <p className="partnerEmptyFeatures">Loading...</p>
          ) : (
            <table className="partnerTable">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Company</th>
                  <th>Title</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(leads || []).map(l => (
                  <tr key={l.email}>
                    <td>{[l.first_name, l.last_name].filter(Boolean).join(' ') || '--'}</td>
                    <td>{l.email}</td>
                    <td>{l.company_name || '--'}</td>
                    <td>{l.title || '--'}</td>
                    <td>{l.status}</td>
                  </tr>
                ))}
                {(leads || []).length === 0 && (
                  <tr><td colSpan={5} className="partnerTableMuted">No leads.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
