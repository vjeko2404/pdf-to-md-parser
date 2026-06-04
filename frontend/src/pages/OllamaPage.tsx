import { useTranslation } from 'react-i18next'
import { Section } from '@/components/common/Section'
import { Toggle } from '@/components/common/Toggle'
import { LlmProviderPanel } from '@/components/settings/LlmProviderPanel'
import { ModelsPanel } from '@/components/ollama/ModelsPanel'
import { PullPanel } from '@/components/ollama/PullPanel'
import { PromptPanel } from '@/components/ollama/PromptPanel'
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
  const { t } = useTranslation('ai')
  const { data: settings } = useSettings()
  const patch = usePatchSettings()
  const setBool = (key: string, v: boolean) => patch.mutate({ [key]: String(v) })
  const isOllama = (settings?.llmProvider ?? 'ollama') !== 'openai'

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <LlmProviderPanel />

      <Section title={t('enrichment.title')} description={t('enrichment.description')}>
        <div className="flex flex-col gap-4">
          <ToggleRow
            label={t('enrichment.enabledLabel')}
            hint={t('enrichment.enabledHint')}
            checked={settings?.enrichmentEnabled === 'true'}
            onChange={(v) => setBool('enrichmentEnabled', v)}
          />
          <ToggleRow
            label={t('enrichment.autoEnrichLabel')}
            hint={t('enrichment.autoEnrichHint')}
            checked={settings?.autoEnrich === 'true'}
            onChange={(v) => setBool('autoEnrich', v)}
          />
          <ToggleRow
            label={t('enrichment.autoCategorizeLabel')}
            hint={t('enrichment.autoCategorizeHint')}
            checked={settings?.autoCategorize === 'true'}
            onChange={(v) => setBool('autoCategorize', v)}
          />
        </div>
      </Section>

      {isOllama && (
        <>
          <ModelsPanel
            activeModel={settings?.ollamaModel}
            onSelect={(m) => patch.mutate({ ollamaModel: m })}
          />
          <PullPanel />
        </>
      )}

      <PromptPanel
        title={t('prompt.enrichTitle')}
        description={t('prompt.enrichDescription')}
        value={settings?.enrichPrompt ?? ''}
        onSave={(p) => patch.mutate({ enrichPrompt: p })}
      />
      <PromptPanel
        title={t('prompt.summaryTitle')}
        description={t('prompt.summaryDescription')}
        value={settings?.summaryPrompt ?? ''}
        onSave={(p) => patch.mutate({ summaryPrompt: p })}
      />
    </div>
  )
}
