import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import client from './client'

// First-party usage tracking. Sends only what the browser alone knows -- which path it is on
// and its own session id. Identity, tenant authorization, country and timestamps are all
// stamped server-side by the gateway from the verified session cookie (see
// gateway/app/main.py: record_usage_event), so nothing here can be spoofed into attributing
// activity to another user or workspace.

const SESSION_KEY = 'usage_session_id'

// One ping a minute is enough to drive a 5-minute "active now" window server-side, while
// staying cheap: liveness updates one row in place rather than inserting an event.
const HEARTBEAT_MS = 60_000

// Used when sessionStorage is unavailable (private windows, storage blocked). A per-load id
// still produces correct data -- it just counts a reload as a new session rather than losing
// the event entirely.
let fallbackSessionId = null

function getSessionId() {
  const generate = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  try {
    let id = sessionStorage.getItem(SESSION_KEY)
    if (!id) {
      id = generate()
      sessionStorage.setItem(SESSION_KEY, id)
    }
    return id
  } catch {
    if (!fallbackSessionId) fallbackSessionId = generate()
    return fallbackSessionId
  }
}

// Which workspace a path belongs to, read from the URL itself.
//
// This deliberately does NOT use client.js's active-tenant variable, which is what the first
// version did. That variable is set by each shell as it mounts, and AdminPartnerView renders
// nothing while it fetches the partner's tenant -- so the pageview for
// /v2/partner-view/<partner>/accounts fired while the variable still said "elephant-edge", and
// every admin visit to a partner's dashboard was recorded as Elephant Edge activity (reproduced
// 2026-09-13). The URL is known the instant navigation happens; no mount order can make it stale.
export function resolveTenantSlug(pathname, user) {
  const partnerView = pathname.match(/^\/v2\/partner-view\/([^/]+)/)
  if (partnerView) return decodeURIComponent(partnerView[1])
  if (pathname === '/v2' || pathname.startsWith('/v2/')) return 'elephant-edge'
  if (pathname === '/partner' || pathname.startsWith('/partner/')) return user?.tenant?.slug || null
  const v1 = pathname.match(/^\/([^/]+)/)
  return v1 ? decodeURIComponent(v1[1]) : null
}

// Always swallows its own errors. Telemetry must never be able to break a page, so a failed
// or blocked analytics call is silently dropped rather than surfaced or retried.
export function sendUsageEvent({ eventType, path, label, tenantSlug }) {
  return client
    .post(
      '/api/usage/event',
      {
        event_type: eventType,
        session_id: getSessionId(),
        path: path ?? null,
        label: label ?? null,
        referrer: document.referrer || null,
        tenant_slug: tenantSlug ?? null,
      },
      { tenantScoped: false },
    )
    .catch(() => {})
}

// A path only counts as viewed once it has stayed put this long. A person does not leave a
// page within a fraction of a second; a redirect does. Without this, one visit to a partner URL
// that hit a redirect loop wrote 1,684 rows (found live 2026-09-13), and ordinary redirect hops
// like / -> /v2 -> /v2/briefing were each recorded as if someone had looked at them.
const SETTLE_MS = 800

/** Mounted once, above every route shell -- see Gate() in App.jsx. */
export function useUsageTracking(user) {
  const location = useLocation()
  const enabled = Boolean(user)
  const lastRecorded = useRef(null)

  useEffect(() => {
    if (!enabled) return
    const path = location.pathname
    const timer = setTimeout(() => {
      // Query-string or hash edits re-run this effect without being a new page.
      if (lastRecorded.current === path) return
      lastRecorded.current = path
      sendUsageEvent({ eventType: 'pageview', path, tenantSlug: resolveTenantSlug(path, user) })
    }, SETTLE_MS)
    // Navigating again before the timer fires cancels this one -- only the page that is
    // actually landed on gets recorded.
    return () => clearTimeout(timer)
  }, [enabled, location.pathname, user])

  useEffect(() => {
    if (!enabled) return
    const timer = setInterval(() => {
      // Only ping while the tab is actually in front. A backgrounded tab left open overnight
      // should not read as someone sitting at the dashboard all night.
      if (document.visibilityState === 'visible' && lastRecorded.current) {
        const path = lastRecorded.current
        sendUsageEvent({ eventType: 'heartbeat', path, tenantSlug: resolveTenantSlug(path, user) })
      }
    }, HEARTBEAT_MS)
    return () => clearInterval(timer)
  }, [enabled, user])
}

export function getUsageSummary(windowDays = 7) {
  return client
    .get('/api/usage/summary', { tenantScoped: false, params: { window_days: windowDays } })
    .then((res) => res.data)
}
