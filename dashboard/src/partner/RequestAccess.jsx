import { useState } from 'react'
import { requestFeatureAccess, formatApiError } from '../v2/api.js'

// Shown for any sidebar tab a partner doesn't actually have working yet -- either not enabled
// at all, or enabled but still missing real config (2026-10-12, explicit instruction,
// generalized for every partner). Previously a not-enabled tab was absent or a non-interactive
// placeholder, and an enabled-but-unconfigured one rendered its real page broken/empty -- both
// now get this same page. Deliberately just a centered heading and the button, per explicit
// instruction ("just at the center show the heading and just the button") -- no description
// text in the layout.
export default function RequestAccess({ featureKey, label }) {
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
    <div className="partnerRequestAccess">
      <h1 className="partnerExecHeading">{label}</h1>

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
