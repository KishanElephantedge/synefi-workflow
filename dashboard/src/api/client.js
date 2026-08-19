import axios from 'axios'

// The gateway is the ONLY thing the browser ever talks to. It authenticates the request
// (via an httpOnly session cookie the browser sends automatically -- never read or set by
// JS, never in localStorage) and, for tenant-scoped calls, resolves the tenant slug to the
// correct backend server-side before proxying. The frontend never sees or stores a raw
// backend URL.
//
// Real bug fix (2026-08-19): the gateway (onrender.com) and this frontend (vercel.app) are
// different registrable domains, so the session cookie was a cross-site cookie. Safari blocks
// ALL cross-site cookies by default via Intelligent Tracking Prevention -- a separate
// mechanism from SameSite, which SameSite=None;Secure does NOT bypass -- so login silently
// never persisted on iPhone/Safari (worked fine on Chrome, which doesn't block third-party
// cookies by default). Fixed by routing production API calls through /gw, which vercel.json
// rewrites (proxies) to the real gateway server-side -- the browser only ever talks to its
// own origin, so the cookie becomes a normal first-party cookie on every browser. Local dev
// (Vite dev server, no Vercel proxy in front of it) still talks to the gateway directly.
const GATEWAY_URL = import.meta.env.DEV ? 'http://localhost:9000' : '/gw'

const client = axios.create({
  baseURL: GATEWAY_URL,
  withCredentials: true, // required for the browser to send the httpOnly session cookie
})

let activeTenantSlug = null

export function setActiveTenant(slug) {
  activeTenantSlug = slug
}

// Tenant-scoped requests are written as relative paths (e.g. '/batches'); this interceptor
// prefixes them with the current tenant's slug so they route through the gateway's
// /api/{tenant_slug}/... proxy. Auth endpoints (/auth/...) and the tenant directory
// (/api/tenants) are called directly and bypass this.
client.interceptors.request.use((config) => {
  if (config.tenantScoped !== false && activeTenantSlug) {
    config.url = `/api/${activeTenantSlug}${config.url}`
  }
  return config
})

export default client
