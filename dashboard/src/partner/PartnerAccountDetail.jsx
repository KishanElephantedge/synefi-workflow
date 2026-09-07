import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getPartnerCompanyDetail, formatApiError } from '../v2/api.js'

function formatRevenue(lo, hi) {
  if (!lo && !hi) return null
  const fmt = (n) => (n >= 1_000_000 ? `$${Math.round(n / 1_000_000)}M` : `$${Math.round(n / 1000)}K`)
  if (lo && hi) return `${fmt(lo)}–${fmt(hi)}`
  return fmt(lo || hi)
}

function initials(first, last) {
  return `${(first || '?')[0]}${(last || '')[0] || ''}`.toUpperCase()
}

export default function PartnerAccountDetail() {
  const { companyId } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    getPartnerCompanyDetail(companyId)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(formatApiError(err)))
    return () => { cancelled = true }
  }, [companyId])

  if (error) {
    return (
      <div>
        <Link className="partnerBackLink" to="/partner/accounts">← Back to accounts</Link>
        <div className="partnerCardWrap"><div className="partnerErrorState">{error}</div></div>
      </div>
    )
  }

  if (!data) {
    return (
      <div>
        <Link className="partnerBackLink" to="/partner/accounts">← Back to accounts</Link>
        <div className="partnerLoadingState">Loading...</div>
      </div>
    )
  }

  const revenue = formatRevenue(data.estimated_revenue_lower_usd, data.estimated_revenue_higher_usd)
  const verifiedContacts = data.contacts.filter((c) => c.verified)
  const unverifiedContacts = data.contacts.filter((c) => !c.verified)

  return (
    <div>
      <Link className="partnerBackLink" to="/partner/accounts">← Back to accounts</Link>

      <div className="partnerDetailHeader">
        <div className="partnerAccountLogo partnerAccountLogoLg">{data.name.slice(0, 1).toUpperCase()}</div>
        <div>
          <h1>{data.name}</h1>
          <div className="partnerDetailMetaRow">
            {data.domain && <a href={`https://${data.domain}`} target="_blank" rel="noreferrer">{data.domain}</a>}
            {data.linkedin_url && (
              <a href={data.linkedin_url} target="_blank" rel="noreferrer">Company LinkedIn</a>
            )}
          </div>
        </div>
      </div>

      <div className="partnerFactRow">
        {data.industry && <div className="partnerFact"><span>Industry</span>{data.industry}</div>}
        {data.employee_count && <div className="partnerFact"><span>Employees</span>{data.employee_count}</div>}
        {revenue && <div className="partnerFact"><span>Est. revenue</span>{revenue}</div>}
        {data.location && <div className="partnerFact"><span>Location</span>{data.location}</div>}
      </div>

      <h2 className="partnerSectionTitle">
        Decision-makers <span className="partnerSectionCount">({data.contacts.length})</span>
      </h2>

      {data.contacts.length === 0 ? (
        <div className="partnerCardWrap"><div className="partnerEmptyState">No contacts found at this company yet.</div></div>
      ) : (
        <>
          {verifiedContacts.length > 0 && (
            <div className="partnerContactGrid">
              {verifiedContacts.map((c) => (
                <ContactCard key={c.id} contact={c} />
              ))}
            </div>
          )}

          {unverifiedContacts.length > 0 && (
            <>
              <h3 className="partnerSubheading">
                Also on file <span className="partnerSectionCount">— unverified, confirm before reaching out</span>
              </h3>
              <div className="partnerContactGrid">
                {unverifiedContacts.map((c) => (
                  <ContactCard key={c.id} contact={c} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function ContactCard({ contact }) {
  return (
    <div className={`partnerContactCard${contact.is_primary ? ' partnerContactCardPrimary' : ''}`}>
      <div className="partnerContactTop">
        <div className="partnerContactAvatar">{initials(contact.first_name, contact.last_name)}</div>
        <div>
          <div className="partnerContactName">{contact.first_name} {contact.last_name}</div>
          <div className="partnerContactTitle">{contact.title || '—'}</div>
        </div>
      </div>
      <div className="partnerContactFooter">
        {contact.is_primary && <span className="partnerTag partnerTagPrimary">Primary</span>}
        {!contact.verified && <span className="partnerTag partnerTagWarn">Unverified</span>}
        {contact.linkedin_url && (
          <a className="partnerContactLink" href={contact.linkedin_url} target="_blank" rel="noreferrer">
            {contact.verified ? 'LinkedIn' : 'Source'}
          </a>
        )}
        {contact.email && <a className="partnerContactLink" href={`mailto:${contact.email}`}>Email</a>}
      </div>
    </div>
  )
}
