import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { Document, Page } from 'react-pdf'
import { useTranslation } from 'react-i18next'
import '@/lib/pdfWorker'

export function PdfPane({
  url,
  containerRef,
}: {
  /** Object URL of the auth-fetched PDF blob (null while loading). */
  url: string | null
  containerRef: RefObject<HTMLDivElement | null>
}) {
  const { t } = useTranslation('document')
  const [pages, setPages] = useState(0)
  // Fit the rendered page to the container instead of a fixed 560px — on a phone that
  // fixed width overflowed horizontally. Capped at 560 so it never balloons on desktop.
  const [pageWidth, setPageWidth] = useState(560)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => setPageWidth(Math.max(240, Math.min(560, el.clientWidth - 32)))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [containerRef, url])

  if (!url)
    return (
      <div ref={containerRef} className="h-full overflow-auto bg-muted/30 p-4">
        <p className="p-4 text-sm text-muted-foreground">{t('pdf.loading')}</p>
      </div>
    )

  return (
    <div ref={containerRef} className="h-full overflow-auto bg-muted/30 p-4">
      <Document
        file={url}
        onLoadSuccess={({ numPages }) => setPages(numPages)}
        loading={<p className="p-4 text-sm text-muted-foreground">{t('pdf.loading')}</p>}
        error={<p className="p-4 text-sm text-destructive">{t('pdf.loadFailed')}</p>}
      >
        {Array.from({ length: pages }, (_, i) => (
          <div
            key={i}
            data-page={i}
            className="pdf-page mx-auto mb-4 w-fit overflow-hidden rounded shadow"
          >
            <Page pageNumber={i + 1} width={pageWidth} renderTextLayer={false} renderAnnotationLayer={false} />
          </div>
        ))}
      </Document>
    </div>
  )
}
