import { Section } from '@/components/common/Section'
import { Toggle } from '@/components/common/Toggle'
import { ModelsPanel } from '@/components/ollama/ModelsPanel'
import { PullPanel } from '@/components/ollama/PullPanel'
import { PromptPanel } from '@/components/ollama/PromptPanel'
import { useOllamaStatus } from '@/hooks/useOllama'
import { usePatchSettings, useSettings } from '@/hooks/useSettings'

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )
}

export function OllamaPage() {
  const { data: status } = useOllamaStatus()
  const { data: settings } = useSettings()
  const patch = usePatchSettings()
  const online = status?.online ?? false
  const setBool = (key: string, v: boolean) => patch.mutate({ [key]: String(v) })

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Section
        title="Ollama"
        description={online ? `online · ${status?.version}` : status?.error ? `offline — ${status.error}` : 'offline'}
      >
        <div className="flex flex-col gap-4">
          <ToggleRow
            label="Enrichment enabled"
            hint="Master switch — when off, the app never calls Ollama."
            checked={settings?.enrichmentEnabled === 'true'}
            onChange={(v) => setBool('enrichmentEnabled', v)}
          />
          <ToggleRow
            label="Auto-enrich on convert"
            hint="Run enrichment automatically after each conversion."
            checked={settings?.autoEnrich === 'true'}
            onChange={(v) => setBool('autoEnrich', v)}
          />
          <ToggleRow
            label="Auto-categorize (LLM)"
            hint="After enrichment, let the model assign matching existing categories."
            checked={settings?.autoCategorize === 'true'}
            onChange={(v) => setBool('autoCategorize', v)}
          />
        </div>
      </Section>

      <ModelsPanel
        activeModel={settings?.ollamaModel}
        onSelect={(m) => patch.mutate({ ollamaModel: m })}
      />
      <PullPanel />
      <PromptPanel
        value={settings?.enrichPrompt ?? ''}
        onSave={(p) => patch.mutate({ enrichPrompt: p })}
      />
      <PromptPanel
        title="Summary prompt"
        description="Separate system prompt for the document's prose summary"
        value={settings?.summaryPrompt ?? ''}
        onSave={(p) => patch.mutate({ summaryPrompt: p })}
      />
    </div>
  )
}
