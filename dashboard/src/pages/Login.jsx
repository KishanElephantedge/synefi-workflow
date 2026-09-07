import { useState } from 'react'
import { useTenant } from '../context/TenantContext'

// Illustrative sample activity for the login page's "Live execution" showcase -- per Majji's
// mockup exactly (names, roles, and task copy). Not a live feed; there's no backend for this.
const LIVE_EXECUTION_ITEMS = [
  { name: 'Raj', role: 'Fractional CRO', done: 'Sent 32 outbound emails', next: 'Following up with 6 warm replies' },
  { name: 'Sam', role: 'Fractional CS', done: 'Closed 3 support tickets', next: 'Scheduling a check-in with a key account' },
  { name: 'Sam', role: 'Fractional CS', done: 'Chased 2 overdue invoices', next: "Logging onboarding notes for a new client" },
  { name: 'Morgan', role: 'Fractional CS', done: 'Closed 3 support tickets', next: 'Scheduling a check-in with a key account' },
  { name: 'Priya', role: 'Fractional CMO', done: 'Scheduled 3 LinkedIn posts for next week', next: "Writing Thursday's newsletter" },
]

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
      {/* Left Pane -- per Majji's mockup: "Live execution" activity feed + tagline, replacing
          the previous metrics/feature-list content. LIVE_EXECUTION_ITEMS is illustrative sample
          data (matches the mockup exactly), not a live feed -- there's no backend for this yet. */}
      <div className="deepline-left-pane">
        <div className="deepline-brand-header">
          <span className="deepline-brand-name">Fractional partner</span>
          <span className="deepline-brand-tagline">The back office for fractional revenue leaders</span>
        </div>

        <div className="deepline-live-card">
          <div className="deepline-live-card-head">
            <span className="deepline-live-label">Live execution</span>
            <span className="deepline-live-counter">
              <strong>3,676</strong>
              <span>today</span>
            </span>
          </div>

          <div className="deepline-live-list">
            {LIVE_EXECUTION_ITEMS.map((item, i) => (
              <div className="deepline-live-item" key={i}>
                <div className="deepline-live-avatar">{item.name[0]}</div>
                <div>
                  <div className="deepline-live-name">{item.name} &middot; {item.role}</div>
                  <div className="deepline-live-done">&#10003; {item.done}</div>
                  <div className="deepline-live-next">&rarr; {item.next}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="deepline-tagline">One system, every job your business needs done.</p>

        <div className="deepline-footer">
          &copy; {new Date().getFullYear()} Fractional Partners. All rights reserved.
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
