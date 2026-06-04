import { getToken, setToken } from './token'
import type { ApiError } from './apiErrors'

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
    let code: string | undefined
    try {
      const j = JSON.parse(body)
      message = j.detail || j.title || message
      // Stable machine code (RFC7807 extension) — used to localize the error via
      // apiErrors.ts when present; falls back to the raw `detail` otherwise.
      if (typeof j.code === 'string') code = j.code
    } catch {
      // body wasn't JSON — use it as-is
    }
    const err = new Error(message) as ApiError
    err.status = res.status
    if (code) err.code = code
    throw err
  }
  if (res.status === 204) return undefined as T
  const ct = res.headers.get('content-type') ?? ''
  return (ct.includes('json') ? res.json() : res.text()) as Promise<T>
}

/** Fetch a binary asset (e.g. the archived PDF) WITH the bearer token, returning a Blob.
 *  Browser-native loaders (react-pdf/PDF.js, <iframe>, <a download>) can't attach the auth
 *  header themselves, so we fetch here and hand them an object URL instead. */
async function blob(path: string): Promise<Blob> {
  const token = getToken()
  const res = await fetch(BASE + path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) {
    if (res.status === 401 && token) {
      setToken(null)
      if (!window.location.pathname.startsWith('/login')) window.location.assign('/login')
    }
    throw new Error(res.statusText)
  }
  return res.blob()
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  blob,
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
  postForm: <T>(p: string, fd: FormData) => request<T>(p, { method: 'POST', body: fd }),
}
