import { Link } from 'react-router-dom'
import { RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { StatusBadge } from './StatusBadge'
import { formatDate } from '@/lib/format'
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
}: DocumentTableProps) {
  const allSelected = docs.length > 0 && docs.every((d) => selected.has(d.id))

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="w-8 p-2">
              <Checkbox checked={allSelected} onChange={onToggleAll} aria-label="Select all" />
            </th>
            <th className="p-2">Name</th>
            <th className="p-2">Type</th>
            <th className="hidden p-2 md:table-cell">Tags</th>
            <th className="p-2">Status</th>
            <th className="hidden p-2 sm:table-cell">Pages</th>
            <th className="hidden p-2 sm:table-cell">Date</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {docs.map((d) => {
            const tags = parseTags(d.tagsJson)
            return (
              <tr key={d.id} className="hover:bg-accent/40">
                <td className="p-2">
                  <Checkbox
                    checked={selected.has(d.id)}
                    onChange={() => onToggle(d.id)}
                    aria-label="Select document"
                  />
                </td>
                <td className="max-w-0 p-2">
                  <Link to={`/doc/${d.id}`} className="block truncate font-medium hover:underline">
                    {d.originalName}
                  </Link>
                </td>
                <td className="p-2 text-muted-foreground">{d.docType ?? '—'}</td>
                <td className="hidden max-w-40 p-2 md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {tags.slice(0, 3).map((t) => (
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
                <td className="hidden p-2 text-muted-foreground sm:table-cell">
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
                      className="text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
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
