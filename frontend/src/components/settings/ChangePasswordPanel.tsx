import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { KeyRound, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { authApi } from '@/api/auth'
import { setToken } from '@/api/token'
import { Section } from '@/components/common/Section'
import { Field } from '@/components/common/Field'
import { PasswordInput } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { PasswordStrength, isStrong } from '@/components/auth/PasswordStrength'

export function ChangePasswordPanel() {
  const { t } = useTranslation('auth')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)

  const matches = next.length > 0 && next === repeat
  const canSubmit = current.length > 0 && isStrong(next) && matches && !busy

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    try {
      const r = await authApi.changePassword(current, next)
      setToken(r.token) // refresh the token (the old one stays valid until expiry too)
      toast.success(t('changePassword.changed'))
      setCurrent('')
      setNext('')
      setRepeat('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('changePassword.couldNotChange'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div id="password">
      <Section title={t('changePassword.title')} description={t('changePassword.description')}>
        <form className="flex max-w-md flex-col gap-3" onSubmit={submit}>
          <Field label={t('changePassword.current')}>
            <PasswordInput
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <Field label={t('changePassword.new')}>
            <PasswordInput
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <PasswordStrength password={next} />
          <Field label={t('changePassword.repeat')}>
            <PasswordInput
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          {repeat.length > 0 && !matches && (
            <p className="text-xs text-destructive">{t('changePassword.passwordsDontMatch')}</p>
          )}
          <div>
            <Button type="submit" variant="button_primary" size="sm" disabled={!canSubmit}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
              {t('changePassword.update')}
            </Button>
          </div>
        </form>
      </Section>
    </div>
  )
}
