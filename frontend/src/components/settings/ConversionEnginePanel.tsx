import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plug, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Section } from '@/components/common/Section'
import { Field } from '@/components/common/Field'
import { TextInput } from '@/components/common/inputs'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { useSettings, usePatchSettings } from '@/hooks/useSettings'
import { settingsApi } from '@/api/settings'

const KEYS = ['conversionEngine', 'markerRemoteUrl']

// Short description shown under the picker for the selected engine.
const ENGINES: { value: string; label: string; desc: string }[] = [
  {
    value: 'off',
    label: 'Off — no conversion',
    desc: 'Conversion is disabled. Uploads and watched files are rejected until you pick an engine.',
  },
  {
    value: 'marker-host',
    label: 'Marker — on this server',
    desc: 'Highest quality (OCR, tables, layout, equations) via the local marker container. Heavy: loads ~5 GB of models on first use and is CPU-intensive — best on a roomy machine.',
  },
  {
    value: 'marker-remote',
    label: 'Marker — off this server',
    desc: 'Use a marker server running elsewhere (e.g. your workstation). Enter its URL below. While it is offline, documents wait and auto-resume the moment it is reachable again — nothing fails.',
  },
  {
    value: 'pdfplumber',
    label: 'pdfplumber — lightweight',
    desc: 'Instant, near-zero-cost text extraction for born-digital PDFs. No OCR, tables, or images — scanned/image-only PDFs will come out empty. Ideal for simple text documents on a small box.',
  },
]

export function ConversionEnginePanel() {
  const { data: settings } = useSettings()
  const patch = usePatchSettings()
  const qc = useQueryClient()
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [testing, setTesting] = useState(false)
  useEffect(() => {
    if (settings) setDraft(settings)
  }, [settings])

  // Live status of the currently-SAVED engine (engine + marker reachability).
  const { data: status } = useQuery({
    queryKey: ['conversion-status'],
    queryFn: settingsApi.conversionStatus,
    refetchInterval: 15_000,
    retry: false,
  })

  const set = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }))
  const engine = draft.conversionEngine ?? 'off'
  const meta = ENGINES.find((e) => e.value === engine) ?? ENGINES[0]

  const save = () =>
    patch.mutate(Object.fromEntries(KEYS.map((k) => [k, draft[k] ?? ''])), {
      onSuccess: () => {
        toast.success('Conversion engine saved')
        qc.invalidateQueries({ queryKey: ['conversion-status'] })
      },
      onError: (e) => toast.error(e.message),
    })

  // Test the typed remote URL directly (no save needed — passed as a query param).
  const testMarker = async () => {
    setTesting(true)
    try {
      const r = await settingsApi.markerTest(draft.markerRemoteUrl ?? '')
      if (r.ok) toast.success(`Marker reachable · ${draft.markerRemoteUrl}`)
      else toast.error(`Unreachable — ${r.detail}`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setTesting(false)
    }
  }

  return (
    <Section
      title="Conversion engine"
      description="How uploaded PDFs are turned into Markdown"
      action={
        <Button variant="button_primary" size="sm" onClick={save}>
          <Save className="size-4" /> Save
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Engine">
          <Select value={engine} onChange={(v) => set('conversionEngine', v)}>
            {ENGINES.map((e) => (
              <option key={e.value} value={e.value}>
                {e.label}
              </option>
            ))}
          </Select>
        </Field>

        <p className="rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
          {meta.desc}
        </p>

        {engine === 'marker-remote' && (
          <>
            <Field label="Marker URL" hint="e.g. http://192.168.1.10:8000 — the marker-server base URL">
              <TextInput
                value={draft.markerRemoteUrl ?? ''}
                onChange={(e) => set('markerRemoteUrl', e.target.value)}
                placeholder="http://your-host:8000"
              />
            </Field>
            <div>
              <Button variant="outline" size="sm" onClick={testMarker} disabled={testing}>
                <Plug className="size-4" /> Test connection
              </Button>
            </div>
          </>
        )}

        {/* Live status of the saved engine. */}
        {status && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              Active engine: <span className="font-medium text-foreground">{status.engine}</span>
            </span>
            {status.healthy != null && (
              <span className="flex items-center gap-1">
                <span
                  className={
                    'inline-block size-2 rounded-full ' +
                    (status.healthy ? 'bg-green-500' : 'bg-destructive')
                  }
                />
                marker {status.healthy ? 'reachable' : 'offline'}
              </span>
            )}
          </div>
        )}
      </div>
    </Section>
  )
}
