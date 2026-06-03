import { Loader2, Pause, Play, Search, Sparkles, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { ViewSwitcher } from './ViewSwitcher'
import type { ViewMode } from '@/hooks/useViewMode'
import type { Category } from '@/api/categories'
import type { DocumentStatus } from '@/types/api'

const STATUSES: (DocumentStatus | 'All')[] = ['All', 'Queued', 'Processing', 'Done', 'Failed']

export interface LibraryToolbarProps {
  search: string
  onSearch: (v: string) => void
  status: string
  onStatus: (v: string) => void
  categories: Category[]
  categoryId: string
  onCategory: (v: string) => void
  sort: string
  onSort: (v: string) => void
  view: ViewMode
  onView: (v: ViewMode) => void
  showViewSwitcher?: boolean
  selectedCount: number
  onEnrichSelected: () => void
  onDeleteSelected: () => void
  enriching: boolean
  paused: boolean
  onTogglePause: () => void
  pauseBusy: boolean
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
    sort,
    onSort,
    view,
    onView,
    showViewSwitcher = true,
    selectedCount,
    onEnrichSelected,
    onDeleteSelected,
    enriching,
    paused,
    onTogglePause,
    pauseBusy,
  } = props

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[12rem] flex-1">
        <Input
          icon={<Search className="size-4" />}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search title, tags, content…"
          className={search ? 'pr-8' : undefined}
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearch('')}
            title="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <Select value={status} onChange={onStatus}>
        {STATUSES.map((s) => (
          <option key={s} value={s === 'All' ? '' : s}>
            {s}
          </option>
        ))}
      </Select>
      <Select value={categoryId} onChange={onCategory}>
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={String(c.id)}>
            {c.name}
          </option>
        ))}
      </Select>
      <Select value={sort} onChange={onSort} title="Sort">
        <option value="">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="name">Name A–Z</option>
        <option value="status">Status</option>
      </Select>
      {selectedCount > 0 && (
        <>
          <Button
            variant="button_primary"
            size="sm"
            onClick={onEnrichSelected}
            disabled={enriching}
          >
            {enriching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {enriching ? 'Enriching…' : `Enrich ${selectedCount}`}
          </Button>
          <Button variant="button_red" size="sm" onClick={onDeleteSelected} disabled={enriching}>
            <Trash2 className="size-4" /> Delete {selectedCount}
          </Button>
        </>
      )}
      <Button
        variant={paused ? 'button_yellow' : 'button_neutral'}
        size="sm"
        onClick={onTogglePause}
        disabled={pauseBusy}
        title={paused ? 'Resume processing' : 'Pause processing'}
      >
        {pauseBusy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : paused ? (
          <Play className="size-4" />
        ) : (
          <Pause className="size-4" />
        )}
        {paused ? 'Resume' : 'Pause'}
      </Button>
      {showViewSwitcher && <ViewSwitcher mode={view} onChange={onView} />}
    </div>
  )
}
