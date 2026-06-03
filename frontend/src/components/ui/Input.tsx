import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Optional leading icon (rendered inside the field). */
  icon?: ReactNode
}

/** Themed text input with an optional leading icon. */
export function Input({ className, icon, ...props }: InputProps) {
  return (
    <div className="relative w-full">
      {icon && (
        <span className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
      )}
      <input
        {...props}
        className={cn(
          'h-9 w-full rounded-md border bg-background text-sm outline-none transition-colors',
          'hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring',
          icon ? 'pl-8 pr-3' : 'px-3',
          className,
        )}
      />
    </div>
  )
}
