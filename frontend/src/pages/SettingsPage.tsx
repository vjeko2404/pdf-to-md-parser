import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { Section } from '@/components/common/Section'
import { Field } from '@/components/common/Field'
import { TextInput } from '@/components/common/inputs'
import { Button } from '@/components/ui/Button'
import { ConversionEnginePanel } from '@/components/settings/ConversionEnginePanel'
import { SecretsPanel } from '@/components/settings/SecretsPanel'
import { ChangePasswordPanel } from '@/components/settings/ChangePasswordPanel'
import { AdminPanel } from '@/components/settings/AdminPanel'
import { usePatchSettings, useSettings } from '@/hooks/useSettings'
import { useAuth } from '@/providers/AuthProvider'

const FIELDS: { key: string; label: string; hint?: string }[] = [
  { key: 'watchSubdir', label: 'Watched subfolder', hint: 'Relative to the mounted host root (/host).' },
  { key: 'debounceSeconds', label: 'Debounce (seconds)' },
]

export function SettingsPage() {
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
    patch.mutate(updates, { onSuccess: () => toast.success('Settings saved') })
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Section
        title="Folder watching"
        description="Auto-import PDFs dropped into your watched folder"
        action={
          <Button variant="button_primary" size="sm" onClick={save}>
            <Save className="size-4" /> Save
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Watch a folder</p>
              <p className="text-xs text-muted-foreground">
                When on, new PDFs in your watched subfolder are imported automatically.
              </p>
            </div>
            <Button
              variant={watchEnabled ? 'button_green' : 'outline'}
              size="sm"
              onClick={() => setDraft((d) => ({ ...d, watchEnabled: watchEnabled ? 'false' : 'true' }))}
            >
              {watchEnabled ? 'On' : 'Off'}
            </Button>
          </div>

          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label} hint={f.hint}>
              <TextInput
                value={draft[f.key] ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              />
            </Field>
          ))}
        </div>
      </Section>

      <ConversionEnginePanel />
      <SecretsPanel />
      <ChangePasswordPanel />
      {isAdmin && <AdminPanel />}
    </div>
  )
}
