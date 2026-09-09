import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import client from '../api/client'
import PartnerApp from '../partner/PartnerApp.jsx'

// Lets an internal admin view a partner's real dashboard (the exact PartnerApp shell that
// partner logs into themselves) directly from V2's workspace switcher, without a second login
// -- the gateway's proxy() already lets an internal user through to any tenant server-side, so
// this is purely a frontend routing gap, not a new access grant. /api/admin/tenants/search is
// already require_internal-gated, so an unauthorized user can't reach this tenant's data through
// here even if they guessed the URL -- the 403 just happens one call later than a route guard
// would, same real protection.
export default function AdminPartnerView() {
  const { tenantSlug } = useParams()
  const [tenant, setTenant] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready | error

  useEffect(() => {
    setStatus('loading')
    client.get('/api/admin/tenants/search', { tenantScoped: false, params: { q: tenantSlug } })
      .then((res) => {
        const match = res.data.find((t) => t.slug === tenantSlug)
        if (!match) {
          setStatus('error')
          return
        }
        setTenant(match)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [tenantSlug])

  if (status === 'loading') return null
  if (status === 'error' || !tenant) {
    return (
      <div style={{ padding: 24 }}>
        <p>Could not load that partner's workspace.</p>
        <Link to="/v2">Back to Elephant Edge V2</Link>
      </div>
    )
  }

  return <PartnerApp tenantOverride={tenant} basePath={`/v2/partner-view/${tenantSlug}`} adminMode />
}
