import { createContext, useContext, useEffect, useState } from 'react'
import client from '../api/client'

const TenantContext = createContext(null)

export function TenantProvider({ children }) {
  const [user, setUser] = useState(null)
  const [tenants, setTenants] = useState([])
  const [loading, setLoading] = useState(true)

  const loadSession = () => {
    setLoading(true)
    client.get('/auth/me', { tenantScoped: false })
      .then(res => {
        setUser(res.data)
        return client.get('/api/tenants', { tenantScoped: false })
      })
      .then(res => {
        setTenants(res.data)
      })
      .catch(() => {
        setUser(null)
        setTenants([])
      })
      .finally(() => setLoading(false))
  }

  useEffect(loadSession, [])

  const login = async (email, password) => {
    await client.post('/auth/login', null, { tenantScoped: false, params: { email, password } })
    loadSession()
  }

  const logout = async () => {
    await client.post('/auth/logout', null, { tenantScoped: false })
    setUser(null)
    setTenants([])
  }

  return (
    <TenantContext.Provider value={{ user, tenants, login, logout, loading }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error('useTenant must be used within a TenantProvider')
  return ctx
}
