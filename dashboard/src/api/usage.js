import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import client, { getActiveTenant } from './client'

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

// Always swallows its own errors. Telemetry must never be able to break a page, so a failed
// or blocked analytics call is silently dropped rather than surfaced or retried.
export function sendUsageEvent({ eventType, path, label }) {
  return client
    .post(
      '/api/usage/event',
      {
        event_type: eventType,
        session_id: getSessionId(),
        path: path ?? null,
        label: label ?? null,
        referrer: document.referrer || null,
        tenant_slug: getActiveTenant(),
      },
      { tenantScoped: false },
    )
    .catch(() => {})
}

/** Mounted once, above every route shell -- see Gate() in App.jsx. */
export function useUsageTracking(enabled = true) {
  const location = useLocation()
  const lastPath = useRef(null)

  useEffect(() => {
    if (!enabled) return
    // React re-runs effects on any location change (including a query-string or hash edit);
    // only a real pathname change is a new pageview.
    if (lastPath.current === location.pathname) return
    lastPath.current = location.pathname
    sendUsageEvent({ eventType: 'pageview', path: location.pathname })
  }, [enabled, location.pathname])

  useEffect(() => {
    if (!enabled) return
    const timer = setInterval(() => {
      // Only ping while the tab is actually in front. A backgrounded tab left open overnight
      // should not read as someone sitting at the dashboard all night.
      if (document.visibilityState === 'visible') {
        sendUsageEvent({ eventType: 'heartbeat', path: lastPath.current })
      }
    }, HEARTBEAT_MS)
    return () => clearInterval(timer)
  }, [enabled])
}

export function getUsageSummary(windowDays = 7) {
  return client
    .get('/api/usage/summary', { tenantScoped: false, params: { window_days: windowDays } })
    .then((res) => res.data)
}
