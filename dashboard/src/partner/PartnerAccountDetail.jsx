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

function formatDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

// Plain-language label for each real email_source value this backend writes -- see
// Contact.email_source's own column comment for the exact vocabulary. Never invents a
// confidence level the data doesn't have; "pattern_guess" says plainly that it's a guess.
const EMAIL_SOURCE_LABEL = {
  deepline: 'Verified email lookup',
  jobo_company: 'Company-level address, not personal',
  pattern_guess: 'Guessed pattern -- not verified, may bounce',
  apollo_manual: 'Found manually via Apollo/Sales Navigator',
}

// Same real branded LinkedIn mark used elsewhere in the app (Targets.jsx) -- reused verbatim
// so the icon is consistent everywhere, not a second lookalike.
function LinkedInBadge() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <rect width="24" height="24" rx="4" fill="#0A66C2" />
      <path fill="#fff" d="M18.335 18.339H15.67v-4.177c0-.996-.02-2.278-1.39-2.278-1.389 0-1.601 1.084-1.601 2.205v4.25h-2.666V9.75h2.56v1.17h.035c.358-.674 1.228-1.387 2.528-1.387 2.7 0 3.2 1.778 3.2 4.091v4.715zM7.003 8.575a1.546 1.546 0 1 1 0-3.091 1.546 1.546 0 0 1 0 3.091zm1.336 9.764H5.666V9.75H8.34v8.589z" />
    </svg>
  )
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
              <a href={data.linkedin_url} target="_blank" rel="noreferrer" className="partnerLinkedinLink">
                <LinkedInBadge /> Company LinkedIn
              </a>
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
      <p className="partnerHint">Click a card for how and when we found this person.</p>

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
  const [open, setOpen] = useState(false)
  const emailLabel = contact.email_source ? (EMAIL_SOURCE_LABEL[contact.email_source] || contact.email_source) : null

  return (
    <div
      className={`partnerContactCard${contact.is_primary ? ' partnerContactCardPrimary' : ''}${open ? ' partnerContactCardOpen' : ''}`}
      onClick={() => setOpen((v) => !v)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setOpen((v) => !v) }}
    >
      <div className="partnerContactTop">
        <div className="partnerContactAvatar">{initials(contact.first_name, contact.last_name)}</div>
        <div>
          <div className="partnerContactName">{contact.first_name} {contact.last_name}</div>
          <div className="partnerContactTitle">{contact.title || '—'}</div>
        </div>
        <span className="partnerContactChevron">{open ? '−' : '+'}</span>
      </div>

      <div className="partnerContactFooter">
        {contact.is_primary && <span className="partnerTag partnerTagPrimary">Primary</span>}
        {!contact.verified && <span className="partnerTag partnerTagWarn">Unverified</span>}
        {contact.linkedin_url && (
          <a
            className="partnerContactLink partnerLinkedinLink" href={contact.linkedin_url}
            target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
          >
            <LinkedInBadge /> {contact.verified ? 'LinkedIn' : 'Source'}
          </a>
        )}
        {contact.email && (
          <a className="partnerContactLink" href={`mailto:${contact.email}`} onClick={(e) => e.stopPropagation()}>Email</a>
        )}
      </div>

      {open && (
        <div className="partnerContactDetail" onClick={(e) => e.stopPropagation()}>
          <div className="partnerDetailRow">
            <span>Email</span>
            {contact.email ? (
              <div>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
                {emailLabel && <div className="partnerDetailSub">{emailLabel}</div>}
              </div>
            ) : (
              <span className="partnerDetailEmpty">Not found yet</span>
            )}
          </div>
          <div className="partnerDetailRow">
            <span>LinkedIn</span>
            {contact.linkedin_url ? (
              <a href={contact.linkedin_url} target="_blank" rel="noreferrer">{contact.linkedin_url}</a>
            ) : (
              <span className="partnerDetailEmpty">Not found yet</span>
            )}
          </div>
          {contact.source_note && (
            <div className="partnerDetailRow">
              <span>How we found them</span>
              <span>{contact.source_note}</span>
            </div>
          )}
          {contact.found_at && (
            <div className="partnerDetailRow">
              <span>Added</span>
              <span>{formatDate(contact.found_at)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
