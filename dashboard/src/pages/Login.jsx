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
      setError(err.response?.data?.detail || 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-container">
      {/* Left Pane - Branding & Intro */}
      <div className="login-left-pane">
        <div className="login-brand-section">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          <span>Sales Operating System</span>
        </div>

        <div className="login-info-section">
          <h2>Automate your outbound GTM engine.</h2>
          <p>Discover high-intent accounts, detect buying signals, identify decision-makers, and execute campaigns autonomously.</p>

          <div className="login-features-list">
            <div className="login-feature-item">
              <div className="login-feature-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"></path></svg>
              </div>
              <div className="login-feature-text">
                <h4>Autonomous Discovery</h4>
                <p>Scrape job boards and signals to target companies with GTM vacancies automatically.</p>
              </div>
            </div>

            <div className="login-feature-item">
              <div className="login-feature-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              </div>
              <div className="login-feature-text">
                <h4>Signal Tracking</h4>
                <p>Track live hiring signals, tech stack changes, and financial data point-in-time.</p>
              </div>
            </div>

            <div className="login-feature-item">
              <div className="login-feature-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              </div>
              <div className="login-feature-text">
                <h4>LinkedIn Automation</h4>
                <p>Deploy personalized connection campaigns directly to decision-maker mailboxes.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="login-footer-section">
          &copy; {new Date().getFullYear()} Elephant Edge. All rights reserved.
        </div>
      </div>

      {/* Right Pane - Sign In Form */}
      <div className="login-right-pane">
        <div className="login-form-box">
          <h1>Sign in</h1>
          <p className="subtitle">Enter your credentials to access your operating system.</p>

          {error && <p className="error">{error}</p>}

          <form onSubmit={submit} className="login-input-group">
            <div className="login-input-wrapper">
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

            <div className="login-input-wrapper">
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

            <button type="submit" className="login-submit-btn" disabled={busy}>
              {busy ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
