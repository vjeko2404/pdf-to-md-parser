import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Section } from '@/components/common/Section'
import { api } from '@/api/client'
import { cn } from '@/lib/utils'
import { formatTime } from '@/lib/format'
import { useSignalR } from '@/hooks/useSignalR'
import type { EventDto } from '@/types/api'

const levelColor = (l: string) =>
  l === 'error' ? 'text-destructive' : l === 'warn' ? 'text-amber-500' : 'text-muted-foreground'

export function LogsPage() {
  const { t } = useTranslation('logs')
  const qc = useQueryClient()
  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: () => api.get<EventDto[]>('/events'),
    refetchInterval: 15_000,
  })
  useSignalR({ documentUpdated: () => qc.invalidateQueries({ queryKey: ['events'] }) })

  return (
    <Section title={t('title')} description={t('description')}>
      <div className="flex flex-col gap-2 font-mono text-xs sm:gap-1">
        {(events ?? []).map((e) => (
          <div
            key={e.id}
            className="flex flex-col gap-0.5 border-b border-border/40 pb-2 last:border-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-2 sm:border-0 sm:pb-0"
          >
            <div className="flex shrink-0 gap-2">
              <span className="text-muted-foreground">{formatTime(e.ts)}</span>
              <span className={cn('w-12 uppercase', levelColor(e.level))}>{e.level}</span>
              <span className="w-16 text-muted-foreground">{e.stage}</span>
            </div>
            {/* Wrap on mobile (the card is narrow), single-line truncate on desktop. */}
            <span className="min-w-0 wrap-break-word sm:truncate">{e.message}</span>
          </div>
        ))}
        {!events?.length && <p className="text-sm text-muted-foreground">{t('empty')}</p>}
      </div>
    </Section>
  )
}
