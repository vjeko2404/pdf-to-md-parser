import { Sparkles, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { Select } from '@/components/ui/Select'
import {
  useAssignCategory,
  useAutoCategorize,
  useCategories,
  useDocCategories,
  useUnassignCategory,
} from '@/hooks/useCategories'

export function CategoryBar({ docId }: { docId: number }) {
  const { t } = useTranslation('document')
  const { data: all = [] } = useCategories()
  const { data: assigned = [] } = useDocCategories(docId)
  const assign = useAssignCategory(docId)
  const unassign = useUnassignCategory(docId)
  const auto = useAutoCategorize(docId)

  const assignedIds = new Set(assigned.map((c) => c.id))
  const available = all.filter((c) => !assignedIds.has(c.id))

  return (
    <div className="flex flex-wrap items-center gap-2">
      {assigned.map((c) => (
        <span
          key={c.id}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
        >
          <span
            className="size-2 rounded-full"
            style={{ background: c.color ?? 'var(--muted-foreground)' }}
          />
          {c.name}
          <button
            onClick={() => unassign.mutate(c.id)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {available.length > 0 && (
        <Select
          value=""
          onChange={(v) => v && assign.mutate(Number(v))}
          className="h-7 pl-2 pr-7 text-xs"
        >
          <option value="">{t('category.addPlaceholder')}</option>
          {available.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </Select>
      )}
      <Tooltip content={t('category.autoTooltip')} asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            auto.mutate(undefined, {
              onSuccess: (r) => {
                const names = (r as { assigned: string[] }).assigned
                toast.success(
                  names.length
                    ? t('category.autoResult', { names: names.join(', ') })
                    : t('category.autoNoMatch'),
                )
              },
              onError: (e) => toast.error(e.message),
            })
          }
        >
          <Sparkles className="size-4" /> {t('category.auto')}
        </Button>
      </Tooltip>
    </div>
  )
}
