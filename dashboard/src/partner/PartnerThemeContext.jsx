import { createContext, useContext, useEffect, useState } from 'react'

// Partner dashboard's own theme state, same architecture as V2ThemeContext.jsx: a real
// user-chosen toggle (light/dark), persisted, applied as a data attribute scoped to this
// shell's own root -- never on <html>/<body>, so it can't leak into or be overridden by the
// browser/OS theme the way the earlier prefers-color-scheme-only version was (found live
// 2026-10-07: that version looked right only by accident of whatever theme the browser
// happened to be in, not a real toggle the partner controls).
const STORAGE_KEY = 'partner-theme'

const PartnerThemeContext = createContext(null)

function getInitialTheme() {
  const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
  if (stored === 'light' || stored === 'dark') return stored
  return 'light'
}

export function PartnerThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  // index.css declares `color-scheme: light dark` on :root for V1's own OS-following pages
  // (intentional, left untouched) -- but color-scheme is read at the DOCUMENT level by the
  // browser's auto-dark-mode heuristic for synthesizing colors on unstyled elements, not just
  // inherited per-element. A div like .partnerShell declaring its own color-scheme does NOT
  // stop that heuristic from repainting <body>/<table>/etc with synthesized dark colors (found
  // live 2026-10-07 via a real dark-browser screenshot: table rows turned near-black even
  // though every partner.css token correctly said "light"). Setting it directly on
  // document.documentElement while this shell is mounted is the only thing that actually
  // suppresses it; reverting on unmount hands V1/V2 pages back their own OS-following behavior.
  useEffect(() => {
    document.documentElement.style.colorScheme = theme
    return () => {
      document.documentElement.style.colorScheme = ''
    }
  }, [theme])

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))

  return (
    <PartnerThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </PartnerThemeContext.Provider>
  )
}

export function usePartnerTheme() {
  const ctx = useContext(PartnerThemeContext)
  if (!ctx) throw new Error('usePartnerTheme must be used within a PartnerThemeProvider')
  return ctx
}
