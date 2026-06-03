import type { SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  /** Convenience: receives the selected value directly (not the event). */
  onChange?: (value: string) => void
}

/** Styled wrapper over a native <select> — keeps full a11y + keyboard, adds a custom chevron. */
export function Select({ className, onChange, children, ...props }: SelectProps) {
  return (
    <div className="relative inline-flex">
      <select
        {...props}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn(
          'h-9 w-full cursor-pointer appearance-none rounded-md border bg-background pl-3 pr-8 text-sm',
          'outline-none transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}
