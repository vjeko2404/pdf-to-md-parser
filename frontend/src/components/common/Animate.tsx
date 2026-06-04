import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Wraps content in a mount-triggered slide-up + fade (`.animate-enter`, which honors
 * `prefers-reduced-motion`). It replays whenever the React `key` changes — so key it
 * by `location.pathname` for route transitions, or by a view mode for tab switches.
 */
export function Animate({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('animate-enter', className)}>{children}</div>
}
