import { getToken, setToken } from './token'

const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData
  const token = getToken()
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })
  if (!res.ok) {
    // A 401 while we were holding a token means the session expired / was revoked —
    // drop it and bounce to the login screen. (Login itself sends no token, so a bad
    // password 401 falls through to normal error handling and shows in the form.)
    if (res.status === 401 && token) {
      setToken(null)
      if (!window.location.pathname.startsWith('/login')) window.location.assign('/login')
    }
    const body = await res.text().catch(() => '')
    let message = body || res.statusText
    try {
      const j = JSON.parse(body)
      message = j.detail || j.title || message
    } catch {
      // body wasn't JSON — use it as-is
    }
    throw new Error(message)
  }
  if (res.status === 204) return undefined as T
  const ct = res.headers.get('content-type') ?? ''
  return (ct.includes('json') ? res.json() : res.text()) as Promise<T>
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: unknown) =>
    request<T>(p, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: <T>(p: string, body: unknown) =>
    request<T>(p, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(p: string, body: unknown) =>
    request<T>(p, { method: 'PATCH', body: JSON.stringify(body) }),
  del: <T>(p: string) => request<T>(p, { method: 'DELETE' }),
  upload: <T>(p: string, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return request<T>(p, { method: 'POST', body: fd })
  },
}
