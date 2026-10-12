import { useState } from 'react'
import { requestFeatureAccess, formatApiError } from '../v2/api.js'

// Shown for any sidebar tab a partner doesn't have enabled yet (2026-10-12, explicit
// instruction, generalized for every partner rather than built one-off for one). Previously
// these tabs were either absent entirely or a non-interactive placeholder div -- now every tab
// is clickable and opens this real page instead.
export default function RequestAccess({ featureKey, label, description }) {
  const [state, setState] = useState('idle') // idle | sending | requested | error
  const [error, setError] = useState('')

  const handleRequest = () => {
    setState('sending')
    setError('')
    requestFeatureAccess(featureKey)
      .then(() => setState('requested'))
      .catch((err) => {
        setState('error')
        setError(formatApiError(err))
      })
  }

  return (
    <div className="partnerExecFeedPage partnerRequestAccess">
      <h1 className="partnerExecHeading">{label}</h1>
      <p className="partnerExecSubheading">{description}</p>

      {state === 'requested' ? (
        <div className="partnerRequestAccessDone">Requested — we’ll be in touch.</div>
      ) : (
        <button
          className="partnerPrimaryBtn partnerRequestAccessBtn"
          onClick={handleRequest}
          disabled={state === 'sending'}
        >
          {state === 'sending' ? 'Requesting…' : 'Request Access'}
        </button>
      )}
      {state === 'error' && <div className="partnerErrorState">{error}</div>}
    </div>
  )
}
