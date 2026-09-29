import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getWebinarDetail, formatApiError } from '../v2/api.js'

// Real webinar detail page (2026-09-29) -- description/agenda/speaker are static event metadata;
// the stat cards below poll every 20s so they visibly move as real sends/clicks happen during an
// active campaign, without the user having to manually reload. Stops polling on unmount (cleanup
// in the effect) so navigating away doesn't leave a stray interval hitting the API forever.
const POLL_MS = 20000

export default function PartnerWebinarDetail({ basePath }) {
  const { webinarId } = useParams()
  const [webinar, setWebinar] = useState(null)
  const [error, setError] = useState(null)
  const timerRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const load = () => {
      getWebinarDetail(webinarId)
        .then(data => { if (!cancelled) setWebinar(data) })
        .catch(e => { if (!cancelled) setError(formatApiError(e)) })
    }
    load()
    timerRef.current = setInterval(load, POLL_MS)
    return () => { cancelled = true; clearInterval(timerRef.current) }
  }, [webinarId])

  if (error) return <div className="partnerMain"><p className="partnerEmptyFeatures">{error}</p></div>
  if (!webinar) return <div className="partnerMain"><p className="partnerEmptyFeatures">Loading...</p></div>

  const { stats } = webinar
  const variants = Object.entries(stats.by_variant || {})

  return (
    <div>
      <Link to={`${basePath}/webinars`} className="partnerBackLink">&larr; Webinars</Link>

      <div className="partnerDetailHeader">
        <h1>{webinar.title}</h1>
        <div className="partnerDetailMetaRow">
          {webinar.speaker_name && <span>with {webinar.speaker_name}</span>}
          <span className="partnerTag">{webinar.status}</span>
          <a href={webinar.event_url} target="_blank" rel="noreferrer">Open event page &rarr;</a>
        </div>
      </div>

      {webinar.description && <p style={{ maxWidth: '640px', lineHeight: 1.5 }}>{webinar.description}</p>}

      {webinar.speaker_bio && (
        <div className="partnerFact" style={{ marginBottom: '1rem' }}>
          <span>Speaker</span>
          {webinar.speaker_bio}
        </div>
      )}

      {Array.isArray(webinar.agenda) && webinar.agenda.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ marginBottom: '0.4rem' }}>What's covered</h3>
          <ul style={{ paddingLeft: '1.2rem', lineHeight: 1.7 }}>
            {webinar.agenda.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>
      )}

      <h3 style={{ marginBottom: '0.5rem' }}>Live stats</h3>
      <div className="partnerStatsRow">
        <div className="partnerStatCard">
          <div className="partnerStatCardValue">{stats.total_sent}</div>
          <div className="partnerStatCardLabel">Invites sent</div>
        </div>
        <div className="partnerStatCard">
          <div className="partnerStatCardValue">{stats.total_clicked}</div>
          <div className="partnerStatCardLabel">Clicked the link</div>
        </div>
        <div className="partnerStatCard">
          <div className="partnerStatCardValue">{stats.click_rate != null ? `${Math.round(stats.click_rate * 100)}%` : '--'}</div>
          <div className="partnerStatCardLabel">Overall click rate</div>
        </div>
      </div>

      {variants.length > 1 && (
        <>
          <h3 style={{ margin: '1.5rem 0 0.5rem' }}>By A/B variant</h3>
          <div className="partnerStatsRow">
            {variants.map(([variant, v]) => (
              <div className="partnerStatCard" key={variant}>
                <div className="partnerStatCardValue">
                  {v.clicked}/{v.sent}
                  {v.click_rate != null && <span style={{ fontSize: '0.9rem', marginLeft: '0.4rem', color: 'var(--partner-muted, #888)' }}>({Math.round(v.click_rate * 100)}%)</span>}
                </div>
                <div className="partnerStatCardLabel">Variant {variant.toUpperCase()}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="partnerEmptyFeatures" style={{ marginTop: '1.5rem' }}>
        {webinar.attendee_data_note}
      </p>
    </div>
  )
}
