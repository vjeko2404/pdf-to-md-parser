import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Bot, Cloud } from 'lucide-react'
import { useSettings } from '@/hooks/useSettings'
import { settingsApi } from '@/api/settings'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/utils'

/** Friendly name for an OpenAI-compatible base URL. */
function providerName(url?: string) {
  if (!url) return 'API'
  try {
    const host = new URL(url).hostname
    if (host.includes('openrouter')) return 'OpenRouter'
    if (host.includes('googleapis')) return 'Gemini'
    if (host.includes('openai')) return 'OpenAI'
    if (host.includes('groq')) return 'Groq'
    return host.replace(/^www\./, '')
  } catch {
    return 'API'
  }
}

/** Live LLM status — shows the selected provider (Ollama or the API client) + online dot. */
export function LlmStatusPill() {
  const { t } = useTranslation('nav')
  const { data: settings } = useSettings()
  const isApi = settings?.llmProvider === 'openai'
  const { data: test } = useQuery({
    queryKey: ['llm-test'],
    queryFn: settingsApi.llmTest,
    refetchInterval: 20_000,
  })
  const online = test?.ok ?? false
  const Icon = isApi ? Cloud : Bot
  const label = isApi
    ? `${providerName(settings?.openaiBaseUrl)}${settings?.openaiModel ? ` · ${settings.openaiModel}` : ''}`
    : online
      ? `Ollama ${(test?.detail ?? '').replace(/^Ollama/i, '').trim()}`.trim()
      : t('llm.ollamaOffline')

  return (
    <Tooltip content={isApi ? label : (test?.detail ?? undefined)} asChild>
      <span
        className={cn(
          'inline-flex max-w-[40vw] items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs sm:max-w-[18rem] sm:px-2.5',
          online ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
        )}
      >
        <Icon className="size-3.5 shrink-0" />
        <span
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            online ? 'bg-emerald-500' : 'bg-muted-foreground/50',
          )}
        />
        {/* Label is the main offender for top-bar overflow on phones — hide it below sm,
            leaving the compact icon + status dot. Full text returns on tablet/desktop. */}
        <span className="hidden truncate sm:inline">{label}</span>
      </span>
    </Tooltip>
  )
}
