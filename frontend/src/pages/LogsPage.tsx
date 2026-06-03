import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Section } from '@/components/common/Section'
import { api } from '@/api/client'
import { cn } from '@/lib/utils'
import { useSignalR } from '@/hooks/useSignalR'
import type { EventDto } from '@/types/api'

const levelColor = (l: string) =>
  l === 'error' ? 'text-destructive' : l === 'warn' ? 'text-amber-500' : 'text-muted-foreground'

export function LogsPage() {
  const qc = useQueryClient()
  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.get<EventDto[]>('/events'),
    refetchInterval: 15_000,
  })
  useSignalR({ documentUpdated: () => qc.invalidateQueries({ queryKey: ['events'] }) })

  return (
    <Section title="Activity log" description="Live pipeline events">
      <div className="flex flex-col gap-1 font-mono text-xs">
        {(events ?? []).map((e) => (
          <div key={e.id} className="flex gap-2">
            <span className="shrink-0 text-muted-foreground">
              {new Date(e.ts).toLocaleTimeString()}
            </span>
            <span className={cn('w-12 shrink-0 uppercase', levelColor(e.level))}>{e.level}</span>
            <span className="w-16 shrink-0 text-muted-foreground">{e.stage}</span>
            <span className="truncate">{e.message}</span>
          </div>
        ))}
        {!events?.length && <p className="text-sm text-muted-foreground">No events yet.</p>}
      </div>
    </Section>
  )
}
