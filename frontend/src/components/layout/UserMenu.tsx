import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, KeyRound, ShieldCheck, ChevronDown, User as UserIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/providers/AuthProvider'

/** Avatar button + dropdown: who you are, change password, log out. */
export function UserMenu() {
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  if (!user) return null

  const go = (path: string) => {
    setOpen(false)
    navigate(path)
  }

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} className="gap-1.5">
        <UserIcon className="size-4" />
        <span className="max-w-20 truncate sm:max-w-32">{user.username}</span>
        {isAdmin && <ShieldCheck className="size-3.5 text-primary" />}
        <ChevronDown className="size-3.5 opacity-60" />
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-lg border bg-card shadow-lg">
          <div className="border-b px-3 py-2">
            <p className="truncate text-sm font-medium">{user.username}</p>
            <p className="text-xs text-muted-foreground">{isAdmin ? 'Administrator' : 'User'}</p>
          </div>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-primary/5"
            onClick={() => go('/settings#password')}
          >
            <KeyRound className="size-4" /> Change password
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
            onClick={() => {
              logout()
              navigate('/login', { replace: true })
            }}
          >
            <LogOut className="size-4" /> Log out
          </button>
        </div>
      )}
    </div>
  )
}
