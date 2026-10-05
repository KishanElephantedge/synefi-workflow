import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listEmailCampaigns, formatApiError } from '../v2/api.js'

// Real Smartlead campaign stats (2026-10-05) for Majji's two "Fractional Partner" campaigns.
// Backend hardcodes exactly these two campaign ids -- the API key behind this can see Elephant
// Edge's whole Smartlead account, so this page (and its backend route) never lists campaigns
// generically, only these two by id.

function CampaignCard({ campaign, basePath }) {
  const errored = campaign.status === 'error'
  return (
    <Link to={`${basePath}/email-campaigns/${campaign.id}`} className="partnerAccountCard">
      <div className="partnerAccountCardTop">
        <div>
          <div className="partnerAccountName">{campaign.label}</div>
          {!errored && <div className="partnerAccountDomain">{campaign.status}</div>}
          {errored && <div className="partnerAccountDomain">Could not load live stats</div>}
        </div>
      </div>
      {!errored && (
        <div className="partnerAccountFooter">
          <span className="partnerTag">{campaign.sent_count} sent</span>
          <span className="partnerTag">{campaign.unique_sent_count} people</span>
          <span className="partnerTag partnerTagPrimary">{campaign.reply_count} replies</span>
          <span className="partnerAccountArrow">&rarr;</span>
        </div>
      )}
    </Link>
  )
}

export default function PartnerEmailCampaigns({ basePath }) {
  const [campaigns, setCampaigns] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    listEmailCampaigns().then(d => setCampaigns(d.campaigns)).catch(e => setError(formatApiError(e)))
  }, [])

  if (error) return <div className="partnerMain"><p className="partnerEmptyFeatures">{error}</p></div>
  if (!campaigns) return <div className="partnerMain"><p className="partnerEmptyFeatures">Loading...</p></div>

  return (
    <div>
      <div className="partnerAccountsHeader">
        <h1>Email</h1>
        <p>Live stats from the two Fractional Partner outreach campaigns.</p>
      </div>

      {campaigns.length === 0 && <p className="partnerEmptyFeatures">No campaigns yet.</p>}

      <div className="partnerAccountGrid">
        {campaigns.map(c => <CampaignCard key={c.id} campaign={c} basePath={basePath} />)}
      </div>
    </div>
  )
}
