import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/utils'
import type { DocCategory } from '@/types/api'

export interface CategoryChipsProps {
  categories?: DocCategory[]
  className?: string
}

/** Colored, clickable category pills. Each links to the Library filtered to that category. */
export function CategoryChips({ categories, className }: CategoryChipsProps) {
  const { t } = useTranslation('library')
  if (!categories?.length) return null
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {categories.map((c) => (
        <Tooltip key={c.id} content={t('categoryChips.filterBy', { name: c.name })} asChild>
          <Link
            to={`/?categoryId=${c.id}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors hover:bg-accent"
            style={{
              borderColor: (c.color ?? 'var(--border)') + '66',
              color: c.color ?? 'var(--foreground)',
            }}
          >
            <span
              className="size-2 rounded-full"
              style={{ background: c.color ?? 'var(--muted-foreground)' }}
            />
            {c.name}
          </Link>
        </Tooltip>
      ))}
    </div>
  )
}
