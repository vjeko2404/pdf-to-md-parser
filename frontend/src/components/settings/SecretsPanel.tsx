import { useState } from 'react'
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Section } from '@/components/common/Section'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/common/inputs'
import { cn } from '@/lib/utils'
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

  // Toggle: reveal fetches+caches the plaintext; clicking again hides it (drops the cache).
  const toggleReveal = async (k: string) => {
    if (revealed[k] != null) {
      setRevealed((s) => {
        const next = { ...s }
        delete next[k]
        return next
      })
      return
    }
    const r = await secretsApi.reveal(k)
    setRevealed((s) => ({ ...s, [k]: r.value }))
  }

  return (
    <Section title="Secrets" description="Encrypted at rest (AES-GCM)">
      <div className="flex flex-col gap-2">
        {(secrets ?? []).map((s) => {
          const shown = revealed[s.key] != null
          return (
            <div key={s.key} className="flex flex-wrap items-center gap-2">
              <span
                className="w-28 shrink-0 truncate text-sm font-medium sm:w-40"
                title={s.key}
              >
                {s.key}
              </span>
              <span
                className={cn(
                  'min-w-0 flex-1 font-mono text-sm text-muted-foreground',
                  // Revealed: wrap so a long key is fully readable on a narrow card.
                  // Masked: keep the dots on a single line.
                  shown ? 'break-all' : 'truncate',
                )}
              >
                {revealed[s.key] ?? s.masked}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleReveal(s.key)}
                title={shown ? 'Hide' : 'Reveal'}
              >
                {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => del.mutate(s.key)} title="Delete">
                <Trash2 className="size-4" />
              </Button>
            </div>
          )
        })}
        {!secrets?.length && <p className="text-sm text-muted-foreground">No secrets yet.</p>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
        <TextInput
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="KEY"
          className="w-32 shrink-0 sm:max-w-40"
        />
        <TextInput
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="value"
          type="password"
          className="min-w-0 flex-1"
        />
        <Button variant="button_primary" size="sm" onClick={add}>
          <Plus className="size-4" /> Add
        </Button>
      </div>
    </Section>
  )
}
