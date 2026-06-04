import { useState, isValidElement, type ReactElement, type ReactNode } from 'react'
import { Popover as BasePopover } from '@base-ui/react/popover'
import { Popover, PopoverTrigger, popoverSurface, type PopoverSide } from '@/components/ui/Popover'
import { cn } from '@/lib/utils'

/**
 * Hover tooltip built on the shared {@link Popover} surface. Wraps `children` as the
 * trigger and reveals `content` after `delay` ms of hovering, fading in (~150ms) and
 * fading out fast (~80ms) the moment the pointer leaves. Renders nothing extra when
 * there's no content. Background/border follow the active theme (`bg-popover`).
 *
 * Because it rides on Base UI's popover (not its tooltip primitive), we keep it
 * tooltip-like by hand: open only on hover/focus (presses are ignored, so clicking
 * the trigger never makes the tip stick) and the popup is `pointer-events-none`.
 *
 * By default the children are wrapped in an `inline-flex` span (the tooltip anchor).
 * Pass `asChild` to merge the trigger onto a single child element instead — required
 * when the child is absolutely positioned or must remain the direct flex/grid item.
 */
export function Tooltip({
  content,
  children,
  delay = 1000,
  side = 'top',
  className,
  asChild = false,
}: {
  content: ReactNode
  children: ReactNode
  /** Hover dwell before the tooltip opens, in ms. */
  delay?: number
  side?: PopoverSide
  /** Class applied to the trigger wrapper span (ignored when `asChild`). */
  className?: string
  /** Merge the trigger onto the single child element instead of wrapping it. */
  asChild?: boolean
}) {
  const [open, setOpen] = useState(false)
  if (content == null || content === '') return <>{children}</>

  return (
    <Popover
      open={open}
      onOpenChange={(next, details) => {
        // Hover/focus drive the tip; ignore presses so clicking the trigger
        // (often a button) doesn't latch it open or toggle it shut.
        if (details.reason === 'trigger-press') return
        setOpen(next)
      }}
    >
      <PopoverTrigger
        openOnHover
        delay={delay}
        closeDelay={0}
        render={
          asChild && isValidElement(children) ? (
            (children as ReactElement)
          ) : (
            (props) => (
              // inline-flex keeps the wrapper from disturbing flex/grid rows of
              // buttons & chips; callers override the display via `className`.
              <span {...props} className={cn('inline-flex', className)}>
                {children}
              </span>
            )
          )
        }
      />
      <BasePopover.Portal>
        <BasePopover.Positioner side={side} sideOffset={6} className="z-50">
          <BasePopover.Popup
            className={cn(
              popoverSurface,
              'pointer-events-none max-w-xs px-2.5 py-1.5 text-xs leading-relaxed',
            )}
          >
            {content}
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </Popover>
  )
}
