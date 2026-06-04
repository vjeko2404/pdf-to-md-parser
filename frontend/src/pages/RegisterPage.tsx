import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('auth')
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
      setError(err instanceof Error ? err.message : t('register.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title={t('register.title')} subtitle={t('register.subtitle')}>
      {allowed === false ? (
        <div className="flex flex-col gap-4 text-center">
          <p className="text-sm text-muted-foreground">
            {t('register.closed')}
          </p>
          <Link to="/login" className="text-sm font-medium text-primary hover:underline">
            {t('register.backToSignIn')}
          </Link>
        </div>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <Field label={t('register.username')} hint={t('register.usernameHint')}>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
            />
          </Field>
          <Field label={t('register.password')}>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
          <PasswordStrength password={password} />
          <Field label={t('register.repeatPassword')}>
            <PasswordInput
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
          {repeat.length > 0 && !matches && (
            <p className="text-xs text-destructive">{t('register.passwordsDontMatch')}</p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" variant="hero_login" disabled={!canSubmit}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            {t('register.createAccount')}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            {t('register.alreadyHaveOne')}{' '}
            <Link to="/login" className="font-medium text-primary hover:underline">
              {t('register.signIn')}
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  )
}
