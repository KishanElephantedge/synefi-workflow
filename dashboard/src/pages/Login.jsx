import { useState } from 'react'
import { useTenant } from '../context/TenantContext'

export default function Login() {
  const { login } = useTenant()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please check your email and password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="deepline-login-container">
      {/* Left Pane - Clean Slate Brand Showcase */}
      <div className="deepline-left-pane">
        <div className="deepline-brand-header">
          <div className="deepline-brand-logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <span>Sales Operating System</span>
        </div>

        <div className="deepline-info-body">
          <h2>Automate your outbound GTM engine.</h2>
          <p>Discover high-intent accounts, detect buying signals, identify decision-makers, and execute multi-channel campaigns autonomously.</p>

          {/* Metric Pills */}
          <div className="deepline-metrics-row">
            <div className="deepline-metric-card">
              <span className="metric-val">20+</span>
              <span className="metric-lbl">Daily Accounts</span>
            </div>
            <div className="deepline-metric-card">
              <span className="metric-val">100%</span>
              <span className="metric-lbl">Verified Leads</span>
            </div>
            <div className="deepline-metric-card">
              <span className="metric-val">0</span>
              <span className="metric-lbl">Manual Data Entry</span>
            </div>
          </div>

          {/* Minimal Feature List */}
          <div className="deepline-features">
            <div className="deepline-feature-item">
              <div className="feature-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"></path></svg>
              </div>
              <div>
                <h4>Autonomous Discovery</h4>
                <p>Scrape active job board feeds (Jobo & Sentrion) for live hiring signals.</p>
              </div>
            </div>

            <div className="deepline-feature-item">
              <div className="feature-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 16 14"></polyline></svg>
              </div>
              <div>
                <h4>Waterfall Enrichment</h4>
                <p>Locate Founders, CEOs, and VPs automatically via multi-source API checks.</p>
              </div>
            </div>

            <div className="deepline-feature-item">
              <div className="feature-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              </div>
              <div>
                <h4>HubSpot & Calendar Sync</h4>
                <p>Register contacts in CRM and sync demo availability to Google Calendar.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="deepline-footer">
          &copy; {new Date().getFullYear()} Elephant Edge. All rights reserved.
        </div>
      </div>

      {/* Right Pane - Crisp White Form Box */}
      <div className="deepline-right-pane">
        <div className="deepline-form-card">
          <div className="deepline-form-header">
            <h1>Sign in</h1>
            <p>Enter your credentials to access your operating system.</p>
          </div>

          {error && <div className="deepline-error-alert">{error}</div>}

          <form onSubmit={submit} className="deepline-form-group">
            <div className="deepline-input-field">
              <label htmlFor="email">Email address</label>
              <input 
                id="email"
                type="email" 
                placeholder="name@company.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
              />
            </div>

            <div className="deepline-input-field">
              <label htmlFor="password">Password</label>
              <input 
                id="password"
                type="password" 
                placeholder="••••••••" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
            </div>

            <div className="deepline-options-row">
              <label className="deepline-checkbox-label">
                <input type="checkbox" defaultChecked />
                <span>Keep me signed in</span>
              </label>
            </div>

            <button type="submit" className="deepline-submit-btn" disabled={busy}>
              {busy ? (
                <>
                  <span className="deepline-spinner"></span>
                  <span>Signing in...</span>
                </>
              ) : (
                <span>Sign in</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
