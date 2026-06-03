import type { ReactNode } from 'react'
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import { cn } from '@/lib/utils'

/**
 * Hover tooltip (Base UI). Wraps `children` as the trigger and shows `content` after `delay`
 * ms of hovering. Renders nothing extra when there's no content. The delay lives on Base UI's
 * Provider in this version, so each Tooltip is self-contained with its own timing.
 */
export function Tooltip({
  content,
  children,
  delay = 600,
  side = 'top',
  className,
}: {
  content: ReactNode
  children: ReactNode
  /** Hover dwell before the tooltip opens, in ms. */
  delay?: number
  side?: 'top' | 'bottom' | 'left' | 'right'
  /** Class applied to the trigger wrapper. */
  className?: string
}) {
  if (content == null || content === '') return <>{children}</>

  return (
    <BaseTooltip.Provider delay={delay}>
      <BaseTooltip.Root>
        <BaseTooltip.Trigger
          render={(props) => (
            <span {...props} className={className}>
              {children}
            </span>
          )}
        />
        <BaseTooltip.Portal>
          <BaseTooltip.Positioner side={side} sideOffset={6} className="z-50">
            <BaseTooltip.Popup
              className={cn(
                'max-w-sm rounded-md border bg-card px-3 py-2 text-xs leading-relaxed',
                'text-foreground shadow-md',
              )}
            >
              {content}
            </BaseTooltip.Popup>
          </BaseTooltip.Positioner>
        </BaseTooltip.Portal>
      </BaseTooltip.Root>
    </BaseTooltip.Provider>
  )
}
