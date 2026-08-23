// Shared timestamp formatting for V2 pages. Backend timestamps are naive UTC -- a string with no
// "Z"/offset gets parsed as LOCAL time by JS, silently shifting it by the browser's UTC offset
// (same fix already applied ad hoc in Network.jsx/Targets.jsx's own timeAgo()). Centralized here
// so every page normalizes the same way instead of re-deriving it.
function normalizeUtc(iso) {
  return /[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`
}

// "Today, 2:41 PM" / "Yesterday, 9:05 AM" / "Aug 12, 2026" -- real Date.created_at, never a
// re-derived or invented "last activity" field. `exact` (for a hover title) is always the full
// local date + time, regardless of which relative bucket the main label falls into.
export function formatRecency(iso) {
  if (!iso) return null
  const date = new Date(normalizeUtc(iso))
  const now = new Date()
  const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)

  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const exact = date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

  let label
  if (isSameDay(date, now)) label = `Today, ${time}`
  else if (isSameDay(date, yesterday)) label = `Yesterday, ${time}`
  else label = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' })

  return { label, exact }
}
