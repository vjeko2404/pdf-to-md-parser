import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dropzone } from '@/components/library/Dropzone'
import { MobileCapture } from '@/components/library/MobileCapture'
import { LibraryToolbar } from '@/components/library/LibraryToolbar'
import { DocumentGrid } from '@/components/library/DocumentGrid'
import { DocumentTable } from '@/components/library/DocumentTable'
import { EditDocumentModal } from '@/components/library/EditDocumentModal'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Animate } from '@/components/common/Animate'
import {
  useDeleteBatch,
  useDeleteDocument,
  useDocuments,
  useEnrichBatch,
  useReconvert,
  useReenrich,
  useRetry,
} from '@/hooks/useDocuments'
import type { EnrichResult } from '@/api/documents'
import { useCategories } from '@/hooks/useCategories'
import { useViewMode } from '@/hooks/useViewMode'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useLibraryFilters } from '@/hooks/useLibraryFilters'
import { usePipelineControl, usePipelineStatus } from '@/hooks/usePipeline'
import { useSignalR } from '@/hooks/useSignalR'
import type { DocumentDto } from '@/types/api'

export function LibraryPage() {
  const { t } = useTranslation('library')
  const { search, setSearch, status, setStatus, categoryId, setCategoryId, sort, setSort } =
    useLibraryFilters()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [editTarget, setEditTarget] = useState<DocumentDto | null>(null)
  const [view, setView] = useViewMode()
  const isMobile = useIsMobile()
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
  const { data: pipeline } = usePipelineStatus()
  const { pause, resume } = usePipelineControl()
  const reenrich = useReenrich()
  const retry = useRetry()
  const reconvert = useReconvert()
  const enrichBatch = useEnrichBatch()
  const remove = useDeleteDocument()
  const removeBatch = useDeleteBatch()

  const paused = pipeline?.paused ?? false
  const pauseBusy = pause.isPending || resume.isPending
  const togglePause = () =>
    (paused ? resume : pause).mutate(undefined, {
      onSuccess: (s) =>
        toast.success(s.paused ? t('toast.processingPaused') : t('toast.processingResumed')),
      onError: (e) => toast.error(e.message),
    })

  useSignalR({
    documentUpdated: () => qc.invalidateQueries({ queryKey: ['documents'] }),
    pipelineState: ((s: { paused: boolean }) =>
      qc.setQueryData(['pipeline-status'], s)) as never,
  })

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
    toast.loading(t('toast.enrichingBatch', { count: ids.length }), { id: 'enrich-batch' })
    enrichBatch.mutate(ids, {
      onSuccess: (res) => {
        const results = (res as EnrichResult[]) ?? []
        const ok = results.filter((r) => r.ok).length
        const failed = results.length - ok
        toast.success(
          failed
            ? t('toast.enrichedFailed', { count: ok, failed })
            : t('toast.enrichedMany', { count: ok }),
          { id: 'enrich-batch' },
        )
        setSelected(new Set())
      },
      onError: (e) => toast.error(e.message, { id: 'enrich-batch' }),
    })
  }

  const onEnrich = (id: number) =>
    reenrich.mutate(id, {
      onSuccess: () => toast.success(t('toast.enriched')),
      onError: (e) => toast.error(e.message),
    })
  const onRetry = (id: number) =>
    retry.mutate(id, { onSuccess: () => toast.success(t('toast.requeued')) })
  const onReconvert = (id: number) =>
    reconvert.mutate(id, {
      onSuccess: () => toast.success(t('toast.reparseQueued')),
      onError: (e) => toast.error(e.message),
    })

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
          toast.success(t('toast.deletedFromVault'))
          deselect([id])
        },
        onError: (e) => toast.error(e.message),
      })
    } else {
      const ids = deleteTarget.ids
      removeBatch.mutate(ids, {
        onSuccess: (res) => {
          const n = (res as { deleted: number } | undefined)?.deleted ?? ids.length
          toast.success(t('toast.deletedMany', { count: n }))
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
    onReconvert,
    onEdit: (doc: DocumentDto) => setEditTarget(doc),
    onDelete: (id: number) => setDeleteTarget({ kind: 'one', id }),
    onTagClick: setSearch,
  }

  return (
    <div className="flex flex-col gap-4">
      <Dropzone />
      {isMobile && <MobileCapture />}
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
        showViewSwitcher={!isMobile}
        selectedCount={selected.size}
        onEnrichSelected={enrichSelected}
        onDeleteSelected={() => setDeleteTarget({ kind: 'many', ids: [...selected] })}
        enriching={enrichBatch.isPending}
        paused={paused}
        onTogglePause={togglePause}
        pauseBusy={pauseBusy}
      />
      {/* Key by content state so the load→ready swap and grid↔table switch each
          replay the entrance animation, keeping navigation feeling alive. */}
      <Animate
        key={
          isLoading
            ? 'loading'
            : docs.length === 0
              ? 'empty'
              : view === 'table' && !isMobile
                ? 'table'
                : 'grid'
        }
      >
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t('empty.loading')}</p>
        ) : docs.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card/50 p-10 text-center text-muted-foreground">
            {t('empty.noDocuments')}
          </div>
        ) : view === 'table' && !isMobile ? (
          <DocumentTable {...sharedProps} onToggleAll={toggleAll} sort={sort} onSort={setSort} />
        ) : (
          <DocumentGrid {...sharedProps} />
        )}
      </Animate>

      <ConfirmDialog
        open={deleteTarget != null}
        title={
          deleteTarget?.kind === 'many'
            ? t('delete.confirmManyTitle', { count: deleteCount })
            : t('delete.confirmOneTitle')
        }
        description={
          deleteTarget?.kind === 'many'
            ? t('delete.confirmManyDescription', { count: deleteCount })
            : deleteOne
              ? t('delete.confirmOneDescription', { name: deleteOne.originalName })
              : undefined
        }
        confirmLabel={
          deleteTarget?.kind === 'many'
            ? t('delete.confirmMany', { count: deleteCount })
            : t('delete.confirmOne')
        }
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <EditDocumentModal
        doc={editTarget}
        categories={categories}
        onClose={() => setEditTarget(null)}
      />
    </div>
  )
}

type DeleteTarget = { kind: 'one'; id: number } | { kind: 'many'; ids: number[] }
