import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { Section } from '@/components/common/Section'
import { Field } from '@/components/common/Field'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ConversionEnginePanel } from '@/components/settings/ConversionEnginePanel'
import { LanguagePanel } from '@/components/settings/LanguagePanel'
import { SecretsPanel } from '@/components/settings/SecretsPanel'
import { ChangePasswordPanel } from '@/components/settings/ChangePasswordPanel'
import { AdminPanel } from '@/components/settings/AdminPanel'
import { usePatchSettings, useSettings } from '@/hooks/useSettings'
import { useAuth } from '@/providers/AuthProvider'

const FIELDS: { key: string; labelKey: string; hintKey?: string }[] = [
  { key: 'watchSubdir', labelKey: 'watch.subdirLabel', hintKey: 'watch.subdirHint' },
  { key: 'debounceSeconds', labelKey: 'watch.debounceLabel' },
]

export function SettingsPage() {
  const { t } = useTranslation('settings')
  const { isAdmin } = useAuth()
  const { data: settings } = useSettings()
  const patch = usePatchSettings()
  const [draft, setDraft] = useState<Record<string, string>>({})
  useEffect(() => {
    if (settings) setDraft(settings)
  }, [settings])

  const watchEnabled = draft.watchEnabled === 'true'

  const save = () => {
    const updates: Record<string, string> = {
      ...Object.fromEntries(FIELDS.map((f) => [f.key, draft[f.key] ?? ''])),
      watchEnabled: watchEnabled ? 'true' : 'false',
    }
    patch.mutate(updates, { onSuccess: () => toast.success(t('watch.saved')) })
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Section
        title={t('watch.title')}
        description={t('watch.description')}
        action={
          <Button variant="button_primary" size="sm" onClick={save}>
            <Save className="size-4" /> {t('common:save')}
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">{t('watch.watchLabel')}</p>
              <p className="text-xs text-muted-foreground">
                {t('watch.watchHint')}
              </p>
            </div>
            <Button
              variant={watchEnabled ? 'button_green' : 'outline'}
              size="sm"
              onClick={() => setDraft((d) => ({ ...d, watchEnabled: watchEnabled ? 'false' : 'true' }))}
            >
              {watchEnabled ? t('common:on') : t('common:off')}
            </Button>
          </div>

          {FIELDS.map((f) => (
            <Field key={f.key} label={t(f.labelKey)} hint={f.hintKey ? t(f.hintKey) : undefined}>
              <Input
                value={draft[f.key] ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              />
            </Field>
          ))}
        </div>
      </Section>

      <LanguagePanel />
      <ConversionEnginePanel />
      <SecretsPanel />
      <ChangePasswordPanel />
      {isAdmin && <AdminPanel />}
    </div>
  )
}
