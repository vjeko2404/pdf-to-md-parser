import { DataTable } from '@/components/ui/DataTable'
import { documentColumns, type DocumentTableMeta } from './documentColumns'
import type { DocumentDto } from '@/types/api'

export interface DocumentTableProps {
  docs: DocumentDto[]
  selected: Set<number>
  onToggle: (id: number) => void
  onEnrich: (id: number) => void
  onRetry: (id: number) => void
  onReconvert: (id: number) => void
  onEdit: (doc: DocumentDto) => void
  onDelete: (id: number) => void
  onTagClick: (tag: string) => void
  onToggleAll: () => void
  sort: string
  onSort: (v: string) => void
}

/**
 * Documents table — a thin binding of {@link DataTable} to {@link documentColumns}.
 * Layout/behaviour lives in those two files; this just funnels props into `meta`.
 */
export function DocumentTable({ docs, ...handlers }: DocumentTableProps) {
  const meta: DocumentTableMeta = {
    ...handlers,
    allSelected: docs.length > 0 && docs.every((d) => handlers.selected.has(d.id)),
  }

  return (
    <DataTable
      columns={documentColumns}
      data={docs}
      meta={meta}
      getRowId={(d) => String(d.id)}
    />
  )
}
