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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={submit} className="card" style={{ width: '20rem' }}>
        <h1 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Sign in</h1>
        {error && <p className="error">{error}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="submit" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
        </div>
      </form>
    </div>
  )
}
