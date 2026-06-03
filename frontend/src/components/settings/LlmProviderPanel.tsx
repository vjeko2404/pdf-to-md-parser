import { useEffect, useState } from 'react'
import { Plug, Save } from 'lucide-react'
import { toast } from 'sonner'
import { Section } from '@/components/common/Section'
import { Field } from '@/components/common/Field'
import { TextInput } from '@/components/common/inputs'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { useSettings, usePatchSettings } from '@/hooks/useSettings'
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

export function LlmProviderPanel() {
  const { data: settings } = useSettings()
  const patch = usePatchSettings()
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [testing, setTesting] = useState(false)
  useEffect(() => {
    if (settings) setDraft(settings)
  }, [settings])

  const set = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }))
  const provider = draft.llmProvider ?? 'ollama'

  const save = () =>
    patch.mutate(Object.fromEntries(KEYS.map((k) => [k, draft[k] ?? ''])), {
      onSuccess: () => toast.success('Provider settings saved'),
      onError: (e) => toast.error(e.message),
    })

  // Ollama: tests the URL currently typed (no save needed — passed as a query param).
  const testOllama = async () => {
    setTesting(true)
    try {
      const r = await ollamaApi.test(draft.ollamaUrl)
      if (r.online) toast.success(`Ollama online · ${r.version ?? ''}`)
      else toast.error(`Offline — ${r.error ?? 'unreachable'}`)
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
      if (r.ok) toast.success(`Connected · ${r.detail ?? ''}`)
      else toast.error(`Failed — ${r.detail ?? 'unreachable'}`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setTesting(false)
    }
  }

  return (
    <Section
      title="LLM provider"
      description="Use local Ollama or any OpenAI-compatible API (OpenRouter, Gemini, …)"
      action={
        <Button variant="button_primary" size="sm" onClick={save}>
          <Save className="size-4" /> Save
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Provider">
          <Select value={provider} onChange={(v) => set('llmProvider', v)}>
            <option value="ollama">Local — Ollama</option>
            <option value="openai">API — OpenAI-compatible</option>
          </Select>
        </Field>

        {provider === 'ollama' ? (
          <>
            <Field label="Ollama URL">
              <TextInput
                value={draft.ollamaUrl ?? ''}
                onChange={(e) => set('ollamaUrl', e.target.value)}
              />
            </Field>
            <Field label="Ollama model">
              <TextInput
                value={draft.ollamaModel ?? ''}
                onChange={(e) => set('ollamaModel', e.target.value)}
              />
            </Field>
            <div>
              <Button variant="outline" size="sm" onClick={testOllama} disabled={testing}>
                <Plug className="size-4" /> Test connection
              </Button>
            </div>
          </>
        ) : (
          <>
            <Field
              label="API base URL"
              hint="e.g. https://openrouter.ai/api/v1 — or Gemini's https://generativelanguage.googleapis.com/v1beta/openai"
            >
              <TextInput
                value={draft.openaiBaseUrl ?? ''}
                onChange={(e) => set('openaiBaseUrl', e.target.value)}
                placeholder="https://openrouter.ai/api/v1"
              />
            </Field>
            <Field label="Model" hint="e.g. google/gemini-2.0-flash-exp:free">
              <TextInput
                value={draft.openaiModel ?? ''}
                onChange={(e) => set('openaiModel', e.target.value)}
                placeholder="google/gemini-2.0-flash-exp:free"
              />
            </Field>
            <Field
              label="API key secret name"
              hint="Add a Secret below with this exact name to hold the key value."
            >
              <TextInput
                value={draft.openaiApiKeyName ?? ''}
                onChange={(e) => set('openaiApiKeyName', e.target.value)}
                placeholder="LLM_API_KEY"
              />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={testProvider} disabled={testing}>
                <Plug className="size-4" /> Test connection
              </Button>
              <span className="text-xs text-muted-foreground">
                Save first — the test uses the stored settings + secret.
              </span>
            </div>
          </>
        )}
      </div>
    </Section>
  )
}
