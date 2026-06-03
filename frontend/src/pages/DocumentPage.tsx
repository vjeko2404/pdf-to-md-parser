import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Copy, Download, Pencil, Printer, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { formatDocType } from '@/lib/format'
import { documentsApi } from '@/api/documents'
import { parseTags } from '@/types/api'
import { PdfPane } from '@/components/doc/PdfPane'
import { MarkdownPane } from '@/components/doc/MarkdownPane'
import { CategoryBar } from '@/components/doc/CategoryBar'
import { TagBar } from '@/components/doc/TagBar'
import { EditDocumentModal } from '@/components/library/EditDocumentModal'
import { LayoutSwitch, type DocLayout } from '@/components/doc/LayoutSwitch'
import { useReconvert } from '@/hooks/useDocuments'
import { useCategories } from '@/hooks/useCategories'
import { useSyncScroll } from '@/hooks/useSyncScroll'
import { useIsMobile } from '@/hooks/useIsMobile'

const overlayCls =
  'absolute right-3 top-3 z-10 flex gap-0.5 rounded-lg border bg-card/90 p-0.5 shadow-sm ' +
  'backdrop-blur transition-opacity opacity-100 md:opacity-0 md:group-hover:opacity-100'

export function DocumentPage() {
  const { id } = useParams()
  const docId = Number(id)
  const isMobile = useIsMobile()
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<DocLayout>(
    () => (localStorage.getItem('doc-layout') as DocLayout | null) ?? 'split',
  )
  const changeLayout = (l: DocLayout) => {
    localStorage.setItem('doc-layout', l)
    setLayout(l)
  }
  const [editing, setEditing] = useState(false)
  const reconvert = useReconvert()
  const { data: categories = [] } = useCategories()

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

  // The PDF endpoint is auth-protected, so we fetch it as a blob (bearer token attached)
  // and hand an object URL to the viewer / download / print — a bare URL would 401.
  const { data: pdfBlob } = useQuery({
    queryKey: ['document-pdf', docId],
    queryFn: () => documentsApi.pdfBlob(docId),
    enabled: Boolean(doc?.archivedPdfPath),
    staleTime: Infinity,
  })
  const pdfUrl = useMemo(() => (pdfBlob ? URL.createObjectURL(pdfBlob) : null), [pdfBlob])
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl) }, [pdfUrl])

  useSyncScroll(leftRef, rightRef, layout === 'split' && !isMobile)

  const tags = parseTags(doc?.tagsJson)
  const baseName = (doc?.originalName ?? 'document').replace(/\.pdf$/i, '')
  const showPdf = layout !== 'md'
  const showMd = layout !== 'pdf'

  const copyMd = async () => {
    if (markdown == null) return
    try {
      await navigator.clipboard.writeText(markdown)
      toast.success('Markdown copied')
    } catch {
      toast.error('Copy failed')
    }
  }

  const downloadMd = () => {
    if (markdown == null) return
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `${baseName}.md`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // Print the rendered Markdown in a clean window with the app's stylesheets copied in.
  const printMd = () => {
    const node = rightRef.current
    if (!node) return
    const w = window.open('', '_blank', 'width=820,height=1000')
    if (!w) {
      toast.error('Allow pop-ups to print')
      return
    }
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"],style'))
      .map((n) => n.outerHTML)
      .join('')
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>${baseName}</title>${styles}</head>` +
        `<body><div class="prose-doc" style="max-width:820px;margin:0 auto;padding:2rem">${node.innerHTML}</div></body></html>`,
    )
    w.document.close()
    w.focus()
    w.setTimeout(() => w.print(), 300)
  }

  // Print the original PDF via a hidden iframe pointed at the (auth-fetched) blob object URL.
  const printPdf = () => {
    if (!pdfUrl) {
      toast.error('PDF still loading')
      return
    }
    const frame = document.createElement('iframe')
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
    frame.src = pdfUrl
    frame.onload = () => {
      try {
        frame.contentWindow?.focus()
        frame.contentWindow?.print()
      } catch {
        window.open(pdfUrl, '_blank')
      }
    }
    document.body.appendChild(frame)
    window.setTimeout(() => frame.remove(), 60_000)
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="size-4" /> Library
            </Link>
          </Button>
          <span className="truncate font-medium">{doc?.originalName}</span>
          {doc?.docType && (
            <span className="rounded-md bg-accent px-2 py-0.5 text-xs text-accent-foreground">
              {formatDocType(doc.docType)}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(true)}
              title="Edit name & categories"
              disabled={!doc}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                reconvert.mutate(docId, {
                  onSuccess: () => toast.success('Re-parsing queued'),
                  onError: (e) => toast.error(e.message),
                })
              }
              title="Re-create parsing"
              disabled={!doc || reconvert.isPending}
            >
              <RefreshCw className="size-4" />
            </Button>
            <LayoutSwitch value={layout} onChange={changeLayout} />
          </div>
        </div>
        {Number.isFinite(docId) && <CategoryBar docId={docId} />}
        {Number.isFinite(docId) && <TagBar docId={docId} tags={tags} />}
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
          'grid gap-3',
          // Desktop: panes fill the remaining viewport height (sync-scroll needs a fixed box).
          // Mobile: give each pane a tall, usable height and let the page scroll — cramming two
          // rows into the short phone viewport made each pane unreadably small.
          isMobile
            ? 'grid-cols-1'
            : cn('flex-1 overflow-hidden', layout === 'split' ? 'grid-cols-2' : 'grid-cols-1'),
        )}
      >
        {showPdf && (
          <div
            className={cn(
              'group relative overflow-hidden rounded-xl border',
              isMobile && 'h-[80vh]',
            )}
          >
            <div className={overlayCls}>
              <Button asChild variant="ghost" size="icon" title="Download PDF" disabled={!pdfUrl}>
                <a href={pdfUrl ?? undefined} download={doc?.originalName}>
                  <Download className="size-4" />
                </a>
              </Button>
              <Button variant="ghost" size="icon" onClick={printPdf} title="Print PDF">
                <Printer className="size-4" />
              </Button>
            </div>
            {Number.isFinite(docId) && <PdfPane url={pdfUrl} containerRef={leftRef} />}
          </div>
        )}
        {showMd && (
          <div
            className={cn(
              'group relative overflow-hidden rounded-xl border bg-card',
              isMobile && 'h-[80vh]',
            )}
          >
            <div className={overlayCls}>
              <Button variant="ghost" size="icon" onClick={copyMd} title="Copy Markdown">
                <Copy className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={downloadMd} title="Download Markdown">
                <Download className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={printMd} title="Print Markdown">
                <Printer className="size-4" />
              </Button>
            </div>
            {markdown != null ? (
              <MarkdownPane markdown={markdown} containerRef={rightRef} />
            ) : (
              <p className="p-6 text-sm text-muted-foreground">No markdown yet.</p>
            )}
          </div>
        )}
      </div>

      <EditDocumentModal
        doc={editing ? (doc ?? null) : null}
        categories={categories}
        onClose={() => setEditing(false)}
      />
    </div>
  )
}
