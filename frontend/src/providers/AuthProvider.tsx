import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { authApi, type UserInfo } from '@/api/auth'
import { getToken, setToken } from '@/api/token'
import { setLanguage } from '@/locales/i18n'

type Status = 'loading' | 'authed' | 'anon'

interface AuthContextValue {
  status: Status
  user: UserInfo | null
  isAdmin: boolean
  login: (username: string, password: string) => Promise<void>
  register: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(() => (getToken() ? 'loading' : 'anon'))
  const [user, setUser] = useState<UserInfo | null>(null)

  // Hydrate the session from a persisted token on first load.
  useEffect(() => {
    if (!getToken()) return
    authApi
      .me()
      .then((u) => {
        setUser(u)
        setStatus('authed')
        if (u.defaultLanguage) setLanguage(u.defaultLanguage)
      })
      .catch(() => {
        setToken(null)
        setStatus('anon')
      })
  }, [])

  const apply = (token: string, u: UserInfo) => {
    setToken(token)
    setUser(u)
    setStatus('authed')
    // Adopt the user's saved language so it follows them across devices/logins.
    if (u.defaultLanguage) setLanguage(u.defaultLanguage)
  }

  const login = async (username: string, password: string) => {
    const r = await authApi.login(username, password)
    apply(r.token, r.user)
  }

  const register = async (username: string, password: string) => {
    const r = await authApi.register(username, password)
    apply(r.token, r.user)
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    setStatus('anon')
  }

  return (
    <AuthContext.Provider
      value={{ status, user, isAdmin: user?.role === 'Admin', login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
