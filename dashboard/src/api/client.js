import axios from 'axios'

// The gateway is the ONLY thing the browser ever talks to. It authenticates the request
// (via an httpOnly session cookie the browser sends automatically -- never read or set by
// JS, never in localStorage) and, for tenant-scoped calls, resolves the tenant slug to the
// correct backend server-side before proxying. The frontend never sees or stores a raw
// backend URL.
//
// VITE_GATEWAY_URL is a build-time env var (set in Vercel's project settings for the
// deployed gateway's real URL); falls back to localhost for local dev.
const GATEWAY_URL = import.meta.env.VITE_GATEWAY_URL || 'http://localhost:9000'

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
