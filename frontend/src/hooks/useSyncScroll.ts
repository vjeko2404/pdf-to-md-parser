import { useEffect } from 'react'
import type { RefObject } from 'react'

/**
 * Page-level scroll sync between two panes. The PDF pane has `.pdf-page[data-page]`
 * children; the Markdown pane has `a.blk[data-page]` anchors. Scrolling one pane
 * aligns the other to the matching page. A short lock prevents feedback loops.
 */
export function useSyncScroll(
  leftRef: RefObject<HTMLDivElement | null>,
  rightRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return
    const left = leftRef.current
    const right = rightRef.current
    if (!left || !right) return

    let lockUntil = 0

    const nearestPage = (container: HTMLElement, selector: string): string | null => {
      const top = container.getBoundingClientRect().top
      let bestPage: string | null = null
      let bestDist = Infinity
      container.querySelectorAll(selector).forEach((el) => {
        const d = Math.abs(el.getBoundingClientRect().top - top)
        if (d < bestDist) {
          bestDist = d
          bestPage = el.getAttribute('data-page')
        }
      })
      return bestPage
    }

    const sync = (from: HTMLElement, fromSel: string, to: HTMLElement, toSel: string) => {
      if (performance.now() < lockUntil) return
      const page = nearestPage(from, fromSel)
      if (page == null) return
      const target = to.querySelector(`${toSel}[data-page="${CSS.escape(page)}"]`)
      if (!target) return
      lockUntil = performance.now() + 150
      to.scrollTop += target.getBoundingClientRect().top - to.getBoundingClientRect().top
    }

    const onLeft = () => sync(left, '.pdf-page', right, 'a.blk')
    const onRight = () => sync(right, 'a.blk', left, '.pdf-page')
    left.addEventListener('scroll', onLeft, { passive: true })
    right.addEventListener('scroll', onRight, { passive: true })
    return () => {
      left.removeEventListener('scroll', onLeft)
      right.removeEventListener('scroll', onRight)
    }
  }, [enabled, leftRef, rightRef])
}
