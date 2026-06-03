import { Loader2 } from 'lucide-react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/providers/AuthProvider'

function FullScreenSpinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
    </div>
  )
}

/** Gate the app behind a valid session. Renders the matched child routes via <Outlet>. */
export function RequireAuth() {
  const { status } = useAuth()
  if (status === 'loading') return <FullScreenSpinner />
  if (status === 'anon') return <Navigate to="/login" replace />
  return <Outlet />
}

/** Admin-only gate (e.g. the user-management panel). Sends non-admins back to the library. */
export function RequireAdmin() {
  const { status, isAdmin } = useAuth()
  if (status === 'loading') return <FullScreenSpinner />
  if (status === 'anon') return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/" replace />
  return <Outlet />
}
