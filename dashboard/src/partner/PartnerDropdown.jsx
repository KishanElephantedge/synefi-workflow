import { useEffect, useRef, useState } from 'react'

// Replaces a native <select> with an in-app-styled menu. Real bug fix, not a preference: a
// native <select>'s dropdown list is rendered by the OS/browser chrome, not by our CSS -- on
// several setups that renders as a large native popup instead of a small anchored menu that
// matches the rest of the app (explicit complaint 2026-09-26: "not showing like a dropdown
// instead they are like popup"). There's no cross-browser way to restyle that native list, so
// the real fix is a custom trigger + our own absolutely-positioned menu.
export default function PartnerDropdown({ value, onChange, options, ariaLabel, disabled, className = '', align = 'left' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const current = options.find((o) => o.value === value)

  return (
    <div className={`partnerDropdown ${className}`} ref={ref}>
      <button
        type="button"
        className="partnerDropdownTrigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="partnerDropdownTriggerLabel">{current ? current.label : ''}</span>
        <span className="partnerDropdownArrow" aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul className={`partnerDropdownMenu${align === 'right' ? ' partnerDropdownMenuRight' : ''}`} role="listbox">
          {options.map((opt) => (
            <li key={opt.value} role="option" aria-selected={opt.value === value}>
              <button
                type="button"
                className={`partnerDropdownOption${opt.value === value ? ' partnerDropdownOptionActive' : ''}`}
                onClick={() => { setOpen(false); onChange(opt.value) }}
              >
                {opt.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
