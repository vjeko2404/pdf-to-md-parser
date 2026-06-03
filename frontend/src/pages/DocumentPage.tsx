import { useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { documentsApi } from '@/api/documents'
import { PdfPane } from '@/components/doc/PdfPane'
import { MarkdownPane } from '@/components/doc/MarkdownPane'
import { useSyncScroll } from '@/hooks/useSyncScroll'
import { useIsMobile } from '@/hooks/useIsMobile'
import { CategoryBar } from '@/components/doc/CategoryBar'

export function DocumentPage() {
  const { id } = useParams()
  const docId = Number(id)
  const isMobile = useIsMobile()
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)

  const { data: doc } = useQuery({
    queryKey: ['document', docId],
    queryFn: () => documentsApi.get(docId),
    enabled: Number.isFinite(docId),
  })
  const { data: markdown } = useQuery({
    queryKey: ['document-md', docId],
    queryFn: () => documentsApi.markdown(docId),
    enabled: Boolean(doc?.mdPath),
  })

  useSyncScroll(leftRef, rightRef, !isMobile)

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="size-4" /> Library
            </Link>
          </Button>
          <span className="truncate font-medium">{doc?.originalName}</span>
          {doc?.docType && (
            <span className="rounded-md bg-accent px-2 py-0.5 text-xs text-accent-foreground">
              {doc.docType}
            </span>
          )}
        </div>
        {Number.isFinite(docId) && <CategoryBar docId={docId} />}
        {doc?.summary && (
          <div className="rounded-xl border bg-card p-3 text-sm leading-relaxed text-muted-foreground">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-foreground/60">
              Summary
            </span>
            {doc.summary}
          </div>
        )}
      </div>
      <div
        className={cn(
          'grid flex-1 gap-3 overflow-hidden',
          isMobile ? 'grid-rows-2' : 'grid-cols-2',
        )}
      >
        <div className="overflow-hidden rounded-xl border">
          {Number.isFinite(docId) && <PdfPane id={docId} containerRef={leftRef} />}
        </div>
        <div className="overflow-hidden rounded-xl border bg-card">
          {markdown != null ? (
            <MarkdownPane markdown={markdown} containerRef={rightRef} />
          ) : (
            <p className="p-6 text-sm text-muted-foreground">No markdown yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
