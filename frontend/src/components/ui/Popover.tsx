import type { ReactNode } from 'react'
import { Popover as BasePopover } from '@base-ui/react/popover'
import { cn } from '@/lib/utils'

export type PopoverSide = 'top' | 'bottom' | 'left' | 'right'
export type PopoverAlign = 'start' | 'center' | 'end'

/**
 * Generic popover surface built on Base UI's `popover` primitive. Re-exports the
 * raw parts (Root/Trigger/Close) plus a styled, animated {@link PopoverContent}.
 * {@link Tooltip} is a thin hover-only wrapper over these same parts — both share
 * {@link popoverSurface} so they look identical and respect the dark/light theme.
 */
export const Popover = BasePopover.Root
export const PopoverTrigger = BasePopover.Trigger
export const PopoverClose = BasePopover.Close

/**
 * Theme-aware, animated popup skin shared by Popover and Tooltip.
 * Fade + subtle scale on enter (~150ms ease-out); faster fade-out (~80ms ease-in)
 * via Base UI's `data-starting-style` / `data-ending-style` lifecycle attributes.
 */
export const popoverSurface = cn(
  'rounded-md border border-border bg-popover text-popover-foreground shadow-md',
  'origin-[var(--transform-origin)] transition-[opacity,transform] duration-150 ease-out',
  'data-[starting-style]:opacity-0 data-[starting-style]:scale-95',
  'data-[ending-style]:opacity-0 data-[ending-style]:scale-95',
  'data-[ending-style]:duration-75 data-[ending-style]:ease-in',
)

/**
 * Styled, portalled content for an interactive (click-triggered) popover.
 * Pair with {@link Popover} + {@link PopoverTrigger}.
 */
export function PopoverContent({
  children,
  side = 'bottom',
  align = 'center',
  sideOffset = 8,
  className,
}: {
  children: ReactNode
  side?: PopoverSide
  align?: PopoverAlign
  sideOffset?: number
  /** Extra classes on the popup (padding/size overrides). */
  className?: string
}) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner side={side} align={align} sideOffset={sideOffset} className="z-50">
        <BasePopover.Popup className={cn(popoverSurface, 'px-4 py-3 text-sm', className)}>
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  )
}
