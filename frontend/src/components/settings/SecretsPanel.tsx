import { useState } from 'react'
import { Eye, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Section } from '@/components/common/Section'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/common/inputs'
import { secretsApi } from '@/api/secrets'
import { useDeleteSecret, useSecrets, useSetSecret } from '@/hooks/useSecrets'

export function SecretsPanel() {
  const { data: secrets } = useSecrets()
  const setSecret = useSetSecret()
  const del = useDeleteSecret()
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [revealed, setRevealed] = useState<Record<string, string>>({})

  const add = () => {
    if (!key.trim()) return
    setSecret.mutate(
      { key: key.trim(), value },
      {
        onSuccess: () => {
          toast.success('Secret saved')
          setKey('')
          setValue('')
        },
      },
    )
  }

  const reveal = async (k: string) => {
    const r = await secretsApi.reveal(k)
    setRevealed((s) => ({ ...s, [k]: r.value }))
  }

  return (
    <Section title="Secrets" description="Encrypted at rest (AES-GCM)">
      <div className="flex flex-col gap-2">
        {(secrets ?? []).map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <span className="w-40 shrink-0 truncate text-sm font-medium">{s.key}</span>
            <span className="flex-1 truncate font-mono text-sm text-muted-foreground">
              {revealed[s.key] ?? s.masked}
            </span>
            <Button variant="ghost" size="sm" onClick={() => reveal(s.key)} title="Reveal">
              <Eye className="size-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => del.mutate(s.key)} title="Delete">
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        {!secrets?.length && <p className="text-sm text-muted-foreground">No secrets yet.</p>}
      </div>
      <div className="mt-3 flex gap-2 border-t pt-3">
        <TextInput
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="KEY"
          className="max-w-40"
        />
        <TextInput
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="value"
          type="password"
        />
        <Button variant="button_primary" size="sm" onClick={add}>
          <Plus className="size-4" /> Add
        </Button>
      </div>
    </Section>
  )
}
