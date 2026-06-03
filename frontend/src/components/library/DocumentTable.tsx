import { Link } from 'react-router-dom'
import { RotateCcw, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from './StatusBadge'
import { parseTags, type DocumentDto } from '@/types/api'

export interface DocumentTableProps {
  docs: DocumentDto[]
  selected: Set<number>
  onToggle: (id: number) => void
  onEnrich: (id: number) => void
  onRetry: (id: number) => void
}

export function DocumentTable({ docs, selected, onToggle, onEnrich, onRetry }: DocumentTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="w-8 p-2" />
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
                  <input
                    type="checkbox"
                    checked={selected.has(d.id)}
                    onChange={() => onToggle(d.id)}
                    className="size-4 accent-primary"
                  />
                </td>
                <td className="max-w-0 p-2">
                  <Link to={`/doc/${d.id}`} className="block truncate font-medium hover:underline">
                    {d.originalName}
                  </Link>
                </td>
                <td className="p-2 text-muted-foreground">{d.docType ?? '—'}</td>
                <td className="hidden max-w-40 truncate p-2 text-muted-foreground md:table-cell">
                  {tags.slice(0, 3).join(', ')}
                </td>
                <td className="p-2">
                  <StatusBadge status={d.status} />
                </td>
                <td className="hidden p-2 text-muted-foreground sm:table-cell">{d.pages}</td>
                <td className="hidden p-2 text-muted-foreground sm:table-cell">
                  {new Date(d.createdAt).toLocaleDateString()}
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
