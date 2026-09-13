import client from './client'

// Tracked short links live on the gateway (see gateway/app/main.py), not in a product backend:
// the redirect has to be reachable at a short, stable, always-on public URL that a prospect
// clicks from LinkedIn, and only the gateway has that surface.

// In production app.fractionalpartner.us rewrites /l/* straight through to the gateway (see
// vercel.json), so a link on this origin is the real, shareable one. The Vite dev server has no
// such rewrite, so local development points at the gateway directly -- same split client.js
// already makes for its own base URL.
export const LINK_BASE = import.meta.env.DEV ? 'http://localhost:9000' : window.location.origin

export function shortUrlFor(slug) {
  return `${LINK_BASE}/l/${slug}`
}

export function listLinks(includeArchived = false) {
  return client
    .get('/api/links', { tenantScoped: false, params: { include_archived: includeArchived } })
    .then((res) => res.data)
}

export function getLink(linkId) {
  return client.get(`/api/links/${linkId}`, { tenantScoped: false }).then((res) => res.data)
}

export function createLink({ destinationUrl, label }) {
  return client
    .post('/api/links', { destination_url: destinationUrl, label: label || null }, { tenantScoped: false })
    .then((res) => res.data)
}

export function toggleArchiveLink(linkId) {
  return client.patch(`/api/links/${linkId}/archive`, null, { tenantScoped: false }).then((res) => res.data)
}
