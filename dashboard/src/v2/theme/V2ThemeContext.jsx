import { createContext, useContext, useEffect, useState } from 'react'

// V2's own theme state -- deliberately NOT touching V1's prefers-color-scheme-only tokens
// (index.css). V2 needs a real toggle (light/dark, user-chosen, persisted), which V1 doesn't
// have. The chosen theme is applied as a data attribute on V2's own shell root (see
// V2AppShell.jsx), never on <html>/<body>, so it cannot affect V1 pages rendered outside /v2.
const STORAGE_KEY = 'v2-theme'

const V2ThemeContext = createContext(null)

function getInitialTheme() {
  const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null
  if (stored === 'light' || stored === 'dark') return stored
  // Dark is the default presentation -- the reference material is predominantly dark (see
  // Phase 0 report, Part 1/9). Not derived from the OS preference like V1's tokens are.
  return 'dark'
}

export function V2ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))

  return (
    <V2ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </V2ThemeContext.Provider>
  )
}

export function useV2Theme() {
  const ctx = useContext(V2ThemeContext)
  if (!ctx) throw new Error('useV2Theme must be used within a V2ThemeProvider')
  return ctx
}
