import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plug, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Section } from '@/components/common/Section'
import { Field } from '@/components/common/Field'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Combobox } from '@/components/ui/Combobox'
import { Button } from '@/components/ui/Button'
import { useSettings, usePatchSettings } from '@/hooks/useSettings'
import { useSecrets } from '@/hooks/useSecrets'
import { ollamaApi } from '@/api/ollama'
import { settingsApi } from '@/api/settings'

const KEYS = [
  'llmProvider',
  'ollamaUrl',
  'ollamaModel',
  'openaiBaseUrl',
  'openaiModel',
  'openaiApiKeyName',
]

const MODELS_LIST_ID = 'llm-models'

export function LlmProviderPanel() {
  const { t } = useTranslation('ai')
  const { data: settings } = useSettings()
  const { data: secrets = [] } = useSecrets()
  const patch = usePatchSettings()
  const qc = useQueryClient()
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [testing, setTesting] = useState(false)
  useEffect(() => {
    if (settings) setDraft(settings)
  }, [settings])

  // Model suggestions for the active (saved) provider — feeds a datalist on the model field.
  const { data: models = [] } = useQuery({
    queryKey: ['llm-models'],
    queryFn: settingsApi.llmModels,
    staleTime: 60_000,
    retry: false,
  })

  const set = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }))
  const provider = draft.llmProvider ?? 'ollama'

  const save = () =>
    patch.mutate(Object.fromEntries(KEYS.map((k) => [k, draft[k] ?? ''])), {
      onSuccess: () => {
        toast.success(t('provider.saved'))
        qc.invalidateQueries({ queryKey: ['llm-models'] })
        qc.invalidateQueries({ queryKey: ['llm-test'] })
      },
      onError: (e) => toast.error(e.message),
    })

  // Ollama: tests the URL currently typed (no save needed — passed as a query param).
  const testOllama = async () => {
    setTesting(true)
    try {
      const r = await ollamaApi.test(draft.ollamaUrl)
      if (r.online) toast.success(t('provider.ollamaOnline', { version: r.version ?? '' }))
      else toast.error(t('provider.ollamaOffline', { error: r.error ?? t('provider.ollamaUnreachable') }))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setTesting(false)
    }
  }

  // API provider: the server reads the saved settings + encrypted secret, so save first.
  const testProvider = async () => {
    setTesting(true)
    try {
      const r = await settingsApi.llmTest()
      if (r.ok) toast.success(t('provider.connected', { detail: r.detail ?? '' }))
      else toast.error(t('provider.connectFailed', { detail: r.detail ?? t('provider.ollamaUnreachable') }))
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setTesting(false)
    }
  }

  // Secret-name dropdown: existing secret keys, keeping any already-saved value selectable.
  const keyName = draft.openaiApiKeyName ?? ''
  const secretNames = secrets.map((s) => s.key)
  const secretOptions =
    keyName && !secretNames.includes(keyName) ? [keyName, ...secretNames] : secretNames

  return (
    <Section
      title={t('provider.title')}
      description={t('provider.description')}
      action={
        <Button variant="button_primary" size="sm" onClick={save}>
          <Save className="size-4" /> {t('common:save')}
        </Button>
      }
    >
      <datalist id={MODELS_LIST_ID}>
        {models.map((m) => (
          <option key={m} value={m} />
        ))}
      </datalist>

      <div className="flex flex-col gap-3">
        <Field label={t('provider.providerLabel')}>
          <Select value={provider} onChange={(v) => set('llmProvider', v)}>
            <option value="ollama">{t('provider.ollamaOption')}</option>
            <option value="openai">{t('provider.openaiOption')}</option>
          </Select>
        </Field>

        {provider === 'ollama' ? (
          <>
            <Field label={t('provider.ollamaUrl')}>
              <Input
                value={draft.ollamaUrl ?? ''}
                onChange={(e) => set('ollamaUrl', e.target.value)}
              />
            </Field>
            <Field label={t('provider.ollamaModel')}>
              <Input
                list={MODELS_LIST_ID}
                value={draft.ollamaModel ?? ''}
                onChange={(e) => set('ollamaModel', e.target.value)}
              />
            </Field>
            <div>
              <Button variant="outline" size="sm" onClick={testOllama} disabled={testing}>
                <Plug className="size-4" /> {t('provider.test')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <Field
              label={t('provider.apiBaseUrl')}
              hint={t('provider.apiBaseUrlHint')}
            >
              <Input
                value={draft.openaiBaseUrl ?? ''}
                onChange={(e) => set('openaiBaseUrl', e.target.value)}
                placeholder="https://openrouter.ai/api/v1"
              />
            </Field>
            <Field
              label={t('provider.modelLabel')}
              hint={
                models.length
                  ? t('provider.modelHintLoaded')
                  : t('provider.modelHintEmpty')
              }
            >
              <Combobox
                value={draft.openaiModel ?? ''}
                onChange={(v) => set('openaiModel', v)}
                items={models}
                placeholder="google/gemini-2.5-flash-lite"
                emptyMessage={t('provider.modelEmptyMessage')}
              />
            </Field>
            <Field
              label={t('provider.apiKeyLabel')}
              hint={t('provider.apiKeyHint')}
            >
              {secretOptions.length ? (
                <Select value={keyName} onChange={(v) => set('openaiApiKeyName', v)}>
                  <option value="">{t('provider.selectSecret')}</option>
                  {secretOptions.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  value={keyName}
                  onChange={(e) => set('openaiApiKeyName', e.target.value)}
                  placeholder={t('provider.apiKeyPlaceholder')}
                />
              )}
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={testProvider} disabled={testing}>
                <Plug className="size-4" /> {t('provider.test')}
              </Button>
              <span className="text-xs text-muted-foreground">
                {t('provider.saveFirst')}
              </span>
            </div>
          </>
        )}
      </div>
    </Section>
  )
}
