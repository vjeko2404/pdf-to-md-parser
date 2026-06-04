import { ArrowDown, ArrowUp } from 'lucide-react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type TableOptions,
} from '@tanstack/react-table'
import { cn } from '@/lib/utils'

// Per-column structural classes (width / responsive visibility / alignment) applied
// to both the header cell and the body cells by the table shell.
declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends unknown, TValue> {
    headerClassName?: string
    cellClassName?: string
  }
}

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[]
  data: TData[]
  /** Shared callbacks/state passed to column headers & cells via `table.options.meta`. */
  meta?: TableOptions<TData>['meta']
  getRowId?: (row: TData) => string
  /** Row shown when `data` is empty (omit if the parent renders its own empty state). */
  emptyMessage?: string
  className?: string
}

/**
 * Reusable, themed table built on @tanstack/react-table. Owns only presentation
 * (rounded card shell, sticky-looking header, hover rows, responsive column classes);
 * all behaviour lives in the `columns` definitions, which read shared state from
 * `meta`. Pair with a per-domain columns file (e.g. `documentColumns`).
 */
export function DataTable<TData>({
  columns,
  data,
  meta,
  getRowId,
  emptyMessage,
  className,
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    meta,
    getRowId,
  })

  return (
    <div className={cn('overflow-x-auto rounded-xl border bg-card', className)}>
      <table className="w-full table-fixed text-sm">
        <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th
                  key={header.id}
                  className={cn('p-2 font-medium', header.column.columnDef.meta?.headerClassName)}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y [&_td]:align-top">
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="hover:bg-accent/40">
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  className={cn('p-2', cell.column.columnDef.meta?.cellClassName)}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {emptyMessage && data.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="p-6 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

/** Sortable header label with a direction arrow — drive it from your own sort state. */
export function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 transition-colors hover:text-foreground',
        active && 'text-foreground',
      )}
    >
      {label}
      {active && (dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
    </button>
  )
}
