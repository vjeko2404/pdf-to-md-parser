import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dropzone } from '@/components/library/Dropzone'
import { LibraryToolbar } from '@/components/library/LibraryToolbar'
import { DocumentGrid } from '@/components/library/DocumentGrid'
import { DocumentTable } from '@/components/library/DocumentTable'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import {
  useDeleteBatch,
  useDeleteDocument,
  useDocuments,
  useEnrichBatch,
  useReenrich,
  useRetry,
} from '@/hooks/useDocuments'
import type { EnrichResult } from '@/api/documents'
import { useCategories } from '@/hooks/useCategories'
import { useViewMode } from '@/hooks/useViewMode'
import { useSignalR } from '@/hooks/useSignalR'

export function LibraryPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [sort, setSort] = useState('') // '' = newest first (default)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [view, setView] = useViewMode()
  const qc = useQueryClient()

  const query = useMemo(
    () => ({
      q: search || undefined,
      status: status || undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      sort: sort || undefined,
    }),
    [search, status, categoryId, sort],
  )
  const { data: docs = [], isLoading } = useDocuments(query)
  const { data: categories = [] } = useCategories()
  const reenrich = useReenrich()
  const retry = useRetry()
  const enrichBatch = useEnrichBatch()
  const remove = useDeleteDocument()
  const removeBatch = useDeleteBatch()

  useSignalR({ documentUpdated: () => qc.invalidateQueries({ queryKey: ['documents'] }) })

  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const toggleAll = () =>
    setSelected((s) => (docs.every((d) => s.has(d.id)) ? new Set() : new Set(docs.map((d) => d.id))))

  const enrichSelected = () => {
    const ids = [...selected]
    if (ids.length === 0) return
    // Loading toast + per-doc SignalR pushes (see EnrichmentService) mean rows
    // refresh live as each finishes; the toast resolves when the batch returns.
    toast.loading(`Enriching ${ids.length} document(s)…`, { id: 'enrich-batch' })
    enrichBatch.mutate(ids, {
      onSuccess: (res) => {
        const results = (res as EnrichResult[]) ?? []
        const ok = results.filter((r) => r.ok).length
        const failed = results.length - ok
        toast.success(failed ? `Enriched ${ok}, ${failed} failed` : `Enriched ${ok} document(s)`, {
          id: 'enrich-batch',
        })
        setSelected(new Set())
      },
      onError: (e) => toast.error(e.message, { id: 'enrich-batch' }),
    })
  }

  const onEnrich = (id: number) =>
    reenrich.mutate(id, {
      onSuccess: () => toast.success('Enriched'),
      onError: (e) => toast.error(e.message),
    })
  const onRetry = (id: number) => retry.mutate(id, { onSuccess: () => toast.success('Re-queued') })

  const deselect = (ids: number[]) =>
    setSelected((s) => {
      const n = new Set(s)
      ids.forEach((id) => n.delete(id))
      return n
    })

  const confirmDelete = () => {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'one') {
      const id = deleteTarget.id
      remove.mutate(id, {
        onSuccess: () => {
          toast.success('Deleted from vault')
          deselect([id])
        },
        onError: (e) => toast.error(e.message),
      })
    } else {
      const ids = deleteTarget.ids
      removeBatch.mutate(ids, {
        onSuccess: (res) => {
          const n = (res as { deleted: number } | undefined)?.deleted ?? ids.length
          toast.success(`Deleted ${n} document(s)`)
          setSelected(new Set())
        },
        onError: (e) => toast.error(e.message),
      })
    }
    setDeleteTarget(null)
  }

  const deleteOne = docs.find((d) => deleteTarget?.kind === 'one' && d.id === deleteTarget.id)
  const deleteCount = deleteTarget?.kind === 'many' ? deleteTarget.ids.length : 0
  const sharedProps = {
    docs,
    selected,
    onToggle: toggle,
    onEnrich,
    onRetry,
    onDelete: (id: number) => setDeleteTarget({ kind: 'one', id }),
    onTagClick: setSearch,
  }

  return (
    <div className="flex flex-col gap-4">
      <Dropzone />
      <LibraryToolbar
        search={search}
        onSearch={setSearch}
        status={status}
        onStatus={setStatus}
        categories={categories}
        categoryId={categoryId}
        onCategory={setCategoryId}
        sort={sort}
        onSort={setSort}
        view={view}
        onView={setView}
        selectedCount={selected.size}
        onEnrichSelected={enrichSelected}
        onDeleteSelected={() => setDeleteTarget({ kind: 'many', ids: [...selected] })}
        enriching={enrichBatch.isPending}
      />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : docs.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/50 p-10 text-center text-muted-foreground">
          No documents yet. Drop a PDF above to get started.
        </div>
      ) : view === 'grid' ? (
        <DocumentGrid {...sharedProps} />
      ) : (
        <DocumentTable {...sharedProps} onToggleAll={toggleAll} sort={sort} onSort={setSort} />
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        title={deleteTarget?.kind === 'many' ? `Delete ${deleteCount} documents?` : 'Delete document?'}
        description={
          deleteTarget?.kind === 'many'
            ? `${deleteCount} documents and all their artifacts (Markdown, images, archived PDF) will be permanently removed from the vault. This cannot be undone.`
            : deleteOne
              ? `“${deleteOne.originalName}” and all its artifacts (Markdown, images, archived PDF) will be permanently removed from the vault. This cannot be undone.`
              : undefined
        }
        confirmLabel={deleteTarget?.kind === 'many' ? `Delete ${deleteCount}` : 'Delete'}
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

type DeleteTarget = { kind: 'one'; id: number } | { kind: 'many'; ids: number[] }
