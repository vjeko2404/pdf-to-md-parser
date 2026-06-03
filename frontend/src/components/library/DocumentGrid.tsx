import { DocumentCard } from './DocumentCard'
import type { DocumentDto } from '@/types/api'

export interface DocumentGridProps {
  docs: DocumentDto[]
  selected: Set<number>
  onToggle: (id: number) => void
  onEnrich: (id: number) => void
  onRetry: (id: number) => void
  onDelete: (id: number) => void
  onTagClick: (tag: string) => void
}

export function DocumentGrid({
  docs,
  selected,
  onToggle,
  onEnrich,
  onRetry,
  onDelete,
  onTagClick,
}: DocumentGridProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {docs.map((doc) => (
        <DocumentCard
          key={doc.id}
          doc={doc}
          selected={selected.has(doc.id)}
          onToggle={onToggle}
          onEnrich={onEnrich}
          onRetry={onRetry}
          onDelete={onDelete}
          onTagClick={onTagClick}
        />
      ))}
    </div>
  )
}
