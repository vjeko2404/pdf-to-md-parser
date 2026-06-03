import { useQuery } from '@tanstack/react-query'
import { Bot, Cloud } from 'lucide-react'
import { useSettings } from '@/hooks/useSettings'
import { settingsApi } from '@/api/settings'
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
      : 'Ollama offline'

  return (
    <span
      className={cn(
        'inline-flex max-w-[18rem] items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs',
        online ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
      )}
      title={test?.detail ?? undefined}
    >
      <Icon className="size-3.5 shrink-0" />
      <span
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          online ? 'bg-emerald-500' : 'bg-muted-foreground/50',
        )}
      />
      <span className="truncate">{label}</span>
    </span>
  )
}
