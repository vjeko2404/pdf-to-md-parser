import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { DocumentStatus } from '@/types/api'

const STYLES: Record<DocumentStatus, string> = {
  Queued: 'bg-muted text-muted-foreground',
  Processing: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  Done: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  Failed: 'bg-destructive/15 text-destructive',
  Skipped: 'bg-muted text-muted-foreground',
}

const LABEL_KEY: Partial<Record<DocumentStatus, string>> = {
  Queued: 'status.queued',
  Processing: 'status.processing',
  Done: 'status.done',
  Failed: 'status.failed',
}

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const { t } = useTranslation('library')
  const key = LABEL_KEY[status]
  const label = key ? t(key) : status
  return (
    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', STYLES[status])}>
      {label}
    </span>
  )
}
