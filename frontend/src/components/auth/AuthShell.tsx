import type { ReactNode } from "react";
import { LanguageSelect } from "@/components/common/LanguageSelect";

/** Centered card used by the login & register screens (outside the app layout). */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      {/* Pre-auth language switch — persists to localStorage only (no account yet). */}
      <div className="absolute right-4 top-4">
        <LanguageSelect persist="local" align="end" />
      </div>
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="group relative mx-auto mb-4 flex size-20 items-center justify-center">
            {/* light-like glow that blooms on hover */}
            <span
              aria-hidden
              className="pointer-events-none absolute -inset-3 rounded-full bg-primary/50 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
            />
            <img
              src="/pdftomd.png"
              alt="PDF → Markdown"
              className="relative size-15 rounded-2xl shadow-sm transition-transform duration-500 ease-out will-change-transform group-hover:rotate-6 group-hover:scale-105"
            />
          </div>
          <div className="mb-3 flex items-center justify-center gap-2 text-lg font-semibold tracking-tight">
            PDF <span className="text-primary">→</span> Markdown
          </div>
          <h1 className="text-xl font-bold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
