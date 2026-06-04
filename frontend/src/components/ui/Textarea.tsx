import type { TextareaHTMLAttributes } from 'react'
import { inputBase } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

/**
 * Canonical themed multi-line field — shares {@link inputBase} with {@link Input}
 * so single- and multi-line fields stay visually consistent. Vertically resizable
 * with a sensible minimum height; override geometry via `className`/`rows`.
 */
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputBase, 'min-h-20 resize-y p-3 leading-relaxed', className)} />
}
