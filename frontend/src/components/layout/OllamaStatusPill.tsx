import { useQuery } from '@tanstack/react-query'
import { Bot } from 'lucide-react'
import { ollamaApi } from '@/api/ollama'
import { cn } from '@/lib/utils'

export function OllamaStatusPill() {
  const { data } = useQuery({
    queryKey: ['ollama-status'],
    queryFn: ollamaApi.status,
    refetchInterval: 10_000,
  })
  const online = data?.online ?? false
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs',
        online ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
      )}
      title={data?.error ?? undefined}
    >
      <Bot className="size-3.5" />
      <span className={cn('size-1.5 rounded-full', online ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
      {online ? `Ollama ${data?.version ?? ''}`.trim() : 'Ollama offline'}
    </span>
  )
}
