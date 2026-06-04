import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plug, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Section } from '@/components/common/Section'
import { Field } from '@/components/common/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { useSettings, usePatchSettings } from '@/hooks/useSettings'
import { settingsApi } from '@/api/settings'

const KEYS = ['conversionEngine', 'markerRemoteUrl']

// Engine option values mapped to their i18n key under engine.options.*
const ENGINES: { value: string; key: string }[] = [
  { value: 'off', key: 'off' },
  { value: 'marker-host', key: 'markerHost' },
  { value: 'marker-remote', key: 'markerRemote' },
  { value: 'pdfplumber', key: 'pdfplumber' },
]

export function ConversionEnginePanel() {
  const { t } = useTranslation('settings')
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
        toast.success(t('engine.saved'))
        qc.invalidateQueries({ queryKey: ['conversion-status'] })
      },
      onError: (e) => toast.error(e.message),
    })

  // Test the typed remote URL directly (no save needed — passed as a query param).
  const testMarker = async () => {
    setTesting(true)
    try {
      const r = await settingsApi.markerTest(draft.markerRemoteUrl ?? '')
      if (r.ok) toast.success(t('engine.markerReachable', { url: draft.markerRemoteUrl }))
      else toast.error(t('engine.unreachable', { detail: r.detail }))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setTesting(false)
    }
  }

  return (
    <Section
      title={t('engine.title')}
      description={t('engine.description')}
      action={
        <Button variant="button_primary" size="sm" onClick={save}>
          <Save className="size-4" /> {t('common:save')}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label={t('engine.engineLabel')}>
          <Select value={engine} onChange={(v) => set('conversionEngine', v)}>
            {ENGINES.map((e) => (
              <option key={e.value} value={e.value}>
                {t(`engine.options.${e.key}.label`)}
              </option>
            ))}
          </Select>
        </Field>

        <p className="rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
          {t(`engine.options.${meta.key}.desc`)}
        </p>

        {engine === 'marker-remote' && (
          <>
            <Field label={t('engine.markerUrlLabel')} hint={t('engine.markerUrlHint')}>
              <Input
                value={draft.markerRemoteUrl ?? ''}
                onChange={(e) => set('markerRemoteUrl', e.target.value)}
                placeholder="http://your-host:8000"
              />
            </Field>
            <div>
              <Button variant="outline" size="sm" onClick={testMarker} disabled={testing}>
                <Plug className="size-4" /> {t('engine.test')}
              </Button>
            </div>
          </>
        )}

        {/* Live status of the saved engine. */}
        {status && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {t('engine.activeEngine')}{' '}
              <span className="font-medium text-foreground">{status.engine}</span>
            </span>
            {status.healthy != null && (
              <span className="flex items-center gap-1">
                <span
                  className={
                    'inline-block size-2 rounded-full ' +
                    (status.healthy ? 'bg-green-500' : 'bg-destructive')
                  }
                />
                marker{' '}
                {status.healthy
                  ? t('engine.markerReachableStatus')
                  : t('engine.markerOfflineStatus')}
              </span>
            )}
          </div>
        )}
      </div>
    </Section>
  )
}
