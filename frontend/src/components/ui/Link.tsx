import type { ReactNode } from 'react'
import { Link as RouterLink, type LinkProps } from 'react-router-dom'
import type { VariantProps } from 'class-variance-authority'
import { Button, ButtonVariants } from './Button'
import { cn } from '@/lib/utils'

type ButtonVariant = VariantProps<typeof ButtonVariants>

export interface LinkProps_
  extends Omit<LinkProps, 'children'>,
    ButtonVariant {
  children: ReactNode
  /** Render as a styled Button (uses `variant`/`size`); otherwise a plain inline anchor. */
  asButton?: boolean
}

/**
 * Reusable client-side link. Two modes:
 *  - default: a plain inline anchor styled like a subtle text link (hover underline).
 *  - `asButton`: wraps the Button component (pass any Button `variant`/`size`).
 * Always a real react-router <Link>, so client-side navigation + query params Just Work.
 */
export function Link({ asButton, variant, size, className, children, ...props }: LinkProps_) {
  if (asButton)
    return (
      <Button asChild variant={variant} size={size}>
        <RouterLink className={className} {...props}>
          {children}
        </RouterLink>
      </Button>
    )

  return (
    <RouterLink
      className={cn(
        'text-primary underline-offset-4 transition-colors hover:underline',
        className,
      )}
      {...props}
    >
      {children}
    </RouterLink>
  )
}
