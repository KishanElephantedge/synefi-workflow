import { createContext, useContext, useEffect, useState } from 'react'
import client, { setActiveTenant } from '../api/client'

const TenantContext = createContext(null)

export function TenantProvider({ children }) {
  const [user, setUser] = useState(null)
  const [tenants, setTenants] = useState([])
  const [tenantId, setTenantIdState] = useState(null)
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
        if (res.data.length > 0) {
          selectTenant(res.data[0].id, res.data)
        }
      })
      .catch(() => {
        setUser(null)
        setTenants([])
      })
      .finally(() => setLoading(false))
  }

  useEffect(loadSession, [])

  const selectTenant = (id, tenantList = tenants) => {
    const tenant = tenantList.find(t => t.id === id)
    setActiveTenant(tenant?.slug)
    setTenantIdState(id)
  }

  const login = async (email, password) => {
    await client.post('/auth/login', null, { tenantScoped: false, params: { email, password } })
    loadSession()
  }

  const logout = async () => {
    await client.post('/auth/logout', null, { tenantScoped: false })
    setUser(null)
    setTenants([])
    setTenantIdState(null)
    setActiveTenant(null)
  }

  return (
    <TenantContext.Provider value={{ user, tenants, tenantId, setTenantId: selectTenant, login, logout, loading }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const ctx = useContext(TenantContext)
  if (!ctx) throw new Error('useTenant must be used within a TenantProvider')
  return ctx
}
