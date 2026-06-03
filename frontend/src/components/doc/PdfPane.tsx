import { useState } from 'react'
import type { RefObject } from 'react'
import { Document, Page } from 'react-pdf'
import { documentsApi } from '@/api/documents'
import '@/lib/pdfWorker'

export function PdfPane({
  id,
  containerRef,
}: {
  id: number
  containerRef: RefObject<HTMLDivElement | null>
}) {
  const [pages, setPages] = useState(0)

  return (
    <div ref={containerRef} className="h-full overflow-auto bg-muted/30 p-4">
      <Document
        file={documentsApi.pdfUrl(id)}
        onLoadSuccess={({ numPages }) => setPages(numPages)}
        loading={<p className="p-4 text-sm text-muted-foreground">Loading PDF…</p>}
        error={<p className="p-4 text-sm text-destructive">Failed to load PDF.</p>}
      >
        {Array.from({ length: pages }, (_, i) => (
          <div
            key={i}
            data-page={i}
            className="pdf-page mx-auto mb-4 w-fit overflow-hidden rounded shadow"
          >
            <Page pageNumber={i + 1} width={560} renderTextLayer={false} renderAnnotationLayer={false} />
          </div>
        ))}
      </Document>
    </div>
  )
}
