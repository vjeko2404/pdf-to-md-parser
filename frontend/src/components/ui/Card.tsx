import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Highlights the card with a solid accent ring (e.g. multi-select). */
  selected?: boolean
}

/**
 * Themed surface card — rounded, bordered, `bg-card`, with a subtle lift and a thin
 * accent ring + border tint on hover so it feels interactive. Layout-neutral (bring
 * your own flex/grid + gap via `className`); when `selected`, the hover treatment is
 * replaced by a solid primary ring. Forwards all `<div>` props (onClick, etc.).
 */
export function Card({ selected, className, ...props }: CardProps) {
  return (
    <div
      data-selected={selected || undefined}
      className={cn(
        'rounded-xl border bg-card p-4 transition-[box-shadow,border-color] duration-200',
        selected
          ? 'ring-2 ring-primary'
          : 'hover:border-primary/40 hover:shadow-sm hover:ring-1 hover:ring-primary/20',
        className,
      )}
      {...props}
    />
  )
}
