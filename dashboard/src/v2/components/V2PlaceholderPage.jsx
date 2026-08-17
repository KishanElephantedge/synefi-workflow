// Phase 1 explicitly stops at the shell -- real page content (data-bound to the GTM-OS backend)
// is Phase 2+ scope. This renders a consistent, styled placeholder so routing/navigation can be
// verified end-to-end without building any page logic yet.
export default function V2PlaceholderPage({ eyebrow, title, note }) {
  return (
    <div>
      <div className="v2-page-head">
        <div className="v2-page-eyebrow">{eyebrow}</div>
        <h1 className="v2-page-title">{title}</h1>
      </div>
      <div className="v2-card">
        <p className="v2-placeholder-note">{note}</p>
      </div>
    </div>
  )
}
