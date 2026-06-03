// Module-level JWT store. Kept outside React so the fetch wrapper (client.ts) and the
// SignalR connection (useSignalR) can read the current token without a hook, while
// AuthProvider owns the user-facing state. Persisted to localStorage so a reload stays
// logged in.
const KEY = 'pdfmd.token'

let token: string | null = localStorage.getItem(KEY)

export function getToken(): string | null {
  return token
}

export function setToken(next: string | null) {
  token = next
  if (next) localStorage.setItem(KEY, next)
  else localStorage.removeItem(KEY)
}
