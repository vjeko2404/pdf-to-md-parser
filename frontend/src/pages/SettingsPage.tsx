import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { Section } from '@/components/common/Section'
import { Field } from '@/components/common/Field'
import { TextInput } from '@/components/common/inputs'
import { Button } from '@/components/ui/Button'
import { SecretsPanel } from '@/components/settings/SecretsPanel'
import { usePatchSettings, useSettings } from '@/hooks/useSettings'

const FIELDS: { key: string; label: string; hint?: string }[] = [
  { key: 'watchSubdir', label: 'Watched subfolder', hint: 'Relative to the mounted host root (/host).' },
  { key: 'ollamaUrl', label: 'Ollama URL' },
  { key: 'ollamaModel', label: 'Ollama model' },
  { key: 'debounceSeconds', label: 'Debounce (seconds)' },
]

export function SettingsPage() {
  const { data: settings } = useSettings()
  const patch = usePatchSettings()
  const [draft, setDraft] = useState<Record<string, string>>({})
  useEffect(() => {
    if (settings) setDraft(settings)
  }, [settings])

  const save = () => {
    const updates = Object.fromEntries(FIELDS.map((f) => [f.key, draft[f.key] ?? '']))
    patch.mutate(updates, { onSuccess: () => toast.success('Settings saved') })
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Section
        title="Settings"
        description="Edit live — folder, model, debounce"
        action={
          <Button variant="button_primary" size="sm" onClick={save}>
            <Save className="size-4" /> Save
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
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
      <SecretsPanel />
    </div>
  )
}
