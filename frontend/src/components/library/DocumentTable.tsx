import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { StatusBadge } from './StatusBadge'
import { formatDate, formatDocType } from '@/lib/format'
import { cn } from '@/lib/utils'
import { parseTags, type DocumentDto } from '@/types/api'

export interface DocumentTableProps {
  docs: DocumentDto[]
  selected: Set<number>
  onToggle: (id: number) => void
  onEnrich: (id: number) => void
  onRetry: (id: number) => void
  onDelete: (id: number) => void
  onTagClick: (tag: string) => void
  onToggleAll: () => void
  sort: string
  onSort: (v: string) => void
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
  className?: string
}) {
  return (
    <th className={className}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-1 transition-colors hover:text-foreground',
          active && 'text-foreground',
        )}
      >
        {label}
        {active &&
          (dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  )
}

export function DocumentTable({
  docs,
  selected,
  onToggle,
  onEnrich,
  onRetry,
  onDelete,
  onTagClick,
  onToggleAll,
  sort,
  onSort,
}: DocumentTableProps) {
  const allSelected = docs.length > 0 && docs.every((d) => selected.has(d.id))
  const dateActive = sort === '' || sort === 'oldest'

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full table-fixed text-sm">
        <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="w-9 p-2">
              <Checkbox checked={allSelected} onChange={onToggleAll} aria-label="Select all" />
            </th>
            <SortHeader
              label="Name"
              className="p-2"
              active={sort === 'name'}
              dir="asc"
              onClick={() => onSort(sort === 'name' ? '' : 'name')}
            />
            <th className="hidden w-40 p-2 lg:table-cell">Type</th>
            <th className="hidden w-64 p-2 md:table-cell">Tags</th>
            <th className="w-24 p-2">Status</th>
            <th className="hidden w-14 p-2 sm:table-cell">Pages</th>
            <SortHeader
              label="Date"
              className="hidden w-28 p-2 sm:table-cell"
              active={dateActive}
              dir={sort === 'oldest' ? 'asc' : 'desc'}
              onClick={() => onSort(sort === 'oldest' ? '' : 'oldest')}
            />
            <th className="w-28 p-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y [&_td]:align-top">
          {docs.map((d) => {
            const tags = parseTags(d.tagsJson)
            const type = formatDocType(d.docType)
            return (
              <tr key={d.id} className="hover:bg-accent/40">
                <td className="p-2">
                  <Checkbox
                    checked={selected.has(d.id)}
                    onChange={() => onToggle(d.id)}
                    aria-label="Select document"
                  />
                </td>
                <td className="p-2">
                  <Link
                    to={`/doc/${d.id}`}
                    className="block truncate font-medium hover:underline"
                    title={d.originalName}
                  >
                    {d.originalName}
                  </Link>
                </td>
                <td className="hidden truncate p-2 text-muted-foreground lg:table-cell" title={type}>
                  {type}
                </td>
                <td className="hidden p-2 md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => onTagClick(t)}
                        title={`Search “${t}”`}
                        className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </td>
                <td className="p-2">
                  <StatusBadge status={d.status} />
                </td>
                <td className="hidden p-2 text-muted-foreground sm:table-cell">{d.pages}</td>
                <td className="hidden whitespace-nowrap p-2 text-muted-foreground sm:table-cell">
                  {formatDate(d.createdAt)}
                </td>
                <td className="p-2">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onEnrich(d.id)} title="Enrich">
                      <Sparkles className="size-4" />
                    </Button>
                    {d.status === 'Failed' && (
                      <Button variant="ghost" size="sm" onClick={() => onRetry(d.id)} title="Retry">
                        <RotateCcw className="size-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(d.id)}
                      title="Delete from vault"
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
