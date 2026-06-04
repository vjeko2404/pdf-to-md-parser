import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Loader2, UserPlus } from 'lucide-react'
import { authApi } from '@/api/auth'
import { Button } from '@/components/ui/Button'
import { Input, PasswordInput } from '@/components/ui/Input'
import { Field } from '@/components/common/Field'
import { AuthShell } from '@/components/auth/AuthShell'
import { PasswordStrength, isStrong } from '@/components/auth/PasswordStrength'
import { useAuth } from '@/providers/AuthProvider'

export function RegisterPage() {
  const { status, register } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    authApi
      .registrationStatus()
      .then((r) => setAllowed(r.enabled))
      .catch(() => setAllowed(false))
  }, [])

  if (status === 'authed') return <Navigate to="/" replace />

  const strong = isStrong(password)
  const matches = password.length > 0 && password === repeat
  const canSubmit = username.trim().length >= 3 && strong && matches && !busy

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      await register(username.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="One library, just for you">
      {allowed === false ? (
        <div className="flex flex-col gap-4 text-center">
          <p className="text-sm text-muted-foreground">
            Registration is currently closed. Ask the administrator to enable it.
          </p>
          <Link to="/login" className="text-sm font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <Field label="Username" hint="At least 3 characters.">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </Field>
          <Field label="Password">
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
          <PasswordStrength password={password} />
          <Field label="Repeat password">
            <PasswordInput
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
          {repeat.length > 0 && !matches && (
            <p className="text-xs text-destructive">Passwords don't match.</p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" variant="hero_login" disabled={!canSubmit}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            Create account
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have one?{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  )
}
