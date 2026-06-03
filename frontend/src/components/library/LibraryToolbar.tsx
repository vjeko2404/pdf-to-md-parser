import { Search, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ViewSwitcher } from './ViewSwitcher'
import type { ViewMode } from '@/hooks/useViewMode'
import type { Category } from '@/api/categories'
import type { DocumentStatus } from '@/types/api'

const STATUSES: (DocumentStatus | 'All')[] = ['All', 'Queued', 'Processing', 'Done', 'Failed']
const selectCls =
  'h-9 rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

export interface LibraryToolbarProps {
  search: string
  onSearch: (v: string) => void
  status: string
  onStatus: (v: string) => void
  categories: Category[]
  categoryId: string
  onCategory: (v: string) => void
  view: ViewMode
  onView: (v: ViewMode) => void
  selectedCount: number
  onEnrichSelected: () => void
}

export function LibraryToolbar(props: LibraryToolbarProps) {
  const {
    search,
    onSearch,
    status,
    onStatus,
    categories,
    categoryId,
    onCategory,
    view,
    onView,
    selectedCount,
    onEnrichSelected,
  } = props

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[12rem] flex-1">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search documents…"
          className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <select value={status} onChange={(e) => onStatus(e.target.value)} className={selectCls}>
        {STATUSES.map((s) => (
          <option key={s} value={s === 'All' ? '' : s}>
            {s}
          </option>
        ))}
      </select>
      <select value={categoryId} onChange={(e) => onCategory(e.target.value)} className={selectCls}>
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={String(c.id)}>
            {c.name}
          </option>
        ))}
      </select>
      {selectedCount > 0 && (
        <Button variant="button_primary" size="sm" onClick={onEnrichSelected}>
          <Sparkles className="size-4" /> Enrich {selectedCount}
        </Button>
      )}
      <ViewSwitcher mode={view} onChange={onView} />
    </div>
  )
}
