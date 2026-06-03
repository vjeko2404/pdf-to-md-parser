import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dropzone } from '@/components/library/Dropzone'
import { LibraryToolbar } from '@/components/library/LibraryToolbar'
import { DocumentGrid } from '@/components/library/DocumentGrid'
import { DocumentTable } from '@/components/library/DocumentTable'
import { useDocuments, useEnrichBatch, useReenrich, useRetry } from '@/hooks/useDocuments'
import { useCategories } from '@/hooks/useCategories'
import { useViewMode } from '@/hooks/useViewMode'
import { useSignalR } from '@/hooks/useSignalR'

export function LibraryPage() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [view, setView] = useViewMode()
  const qc = useQueryClient()

  const query = useMemo(
    () => ({
      q: search || undefined,
      status: status || undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
    }),
    [search, status, categoryId],
  )
  const { data: docs = [], isLoading } = useDocuments(query)
  const { data: categories = [] } = useCategories()
  const reenrich = useReenrich()
  const retry = useRetry()
  const enrichBatch = useEnrichBatch()

  useSignalR({ documentUpdated: () => qc.invalidateQueries({ queryKey: ['documents'] }) })

  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const enrichSelected = () => {
    const ids = [...selected]
    enrichBatch.mutate(ids, {
      onSuccess: () => {
        toast.success(`Enriching ${ids.length} document(s)`)
        setSelected(new Set())
      },
      onError: (e) => toast.error(e.message),
    })
  }

  const onEnrich = (id: number) =>
    reenrich.mutate(id, {
      onSuccess: () => toast.success('Enriched'),
      onError: (e) => toast.error(e.message),
    })
  const onRetry = (id: number) => retry.mutate(id, { onSuccess: () => toast.success('Re-queued') })

  const gridProps = { docs, selected, onToggle: toggle, onEnrich, onRetry }

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
        view={view}
        onView={setView}
        selectedCount={selected.size}
        onEnrichSelected={enrichSelected}
      />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : docs.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card/50 p-10 text-center text-muted-foreground">
          No documents yet. Drop a PDF above to get started.
        </div>
      ) : view === 'grid' ? (
        <DocumentGrid {...gridProps} />
      ) : (
        <DocumentTable {...gridProps} />
      )}
    </div>
  )
}
