import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Loader2, LogIn } from 'lucide-react'
import { authApi } from '@/api/auth'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/common/inputs'
import { Field } from '@/components/common/Field'
import { AuthShell } from '@/components/auth/AuthShell'
import { useAuth } from '@/providers/AuthProvider'

export function LoginPage() {
  const { status, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [canRegister, setCanRegister] = useState(false)

  useEffect(() => {
    authApi
      .registrationStatus()
      .then((r) => setCanRegister(r.enabled))
      .catch(() => setCanRegister(false))
  }, [])

  if (status === 'authed') return <Navigate to="/" replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(username.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your library">
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Field label="Username">
          <TextInput
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </Field>
        <Field label="Password">
          <TextInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" variant="hero_login" disabled={busy || !username || !password}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
          Sign in
        </Button>

        {canRegister && (
          <p className="text-center text-sm text-muted-foreground">
            No account?{' '}
            <Link to="/register" className="font-medium text-primary hover:underline">
              Register
            </Link>
          </p>
        )}
      </form>
    </AuthShell>
  )
}
