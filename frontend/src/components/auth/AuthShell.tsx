import type { ReactNode } from 'react'

/** Centered card used by the login & register screens (outside the app layout). */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="mb-3 flex items-center justify-center gap-2 text-lg font-semibold tracking-tight">
            PDF <span className="text-primary">→</span> Markdown
          </div>
          <h1 className="text-xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}
