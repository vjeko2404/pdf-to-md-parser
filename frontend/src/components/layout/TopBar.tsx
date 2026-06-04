import { Menu } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from './ThemeToggle'
import { LlmStatusPill } from './LlmStatusPill'
import { UserMenu } from './UserMenu'

export function TopBar({ isMobile, onMenu }: { isMobile: boolean; onMenu: () => void }) {
  return (
    <header className="flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center gap-2 border-b bg-card px-3 pt-[env(safe-area-inset-top)] sm:gap-3 sm:px-4">
      {isMobile && (
        <Button variant="ghost" size="icon" onClick={onMenu} className="shrink-0">
          <Menu className="size-5" />
        </Button>
      )}
      <Link
        to="/"
        className="flex min-w-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="PDF → Markdown — Library"
      >
        <img
          src="/pdftomd.png"
          alt="PDF → Markdown"
          className="hidden size-8 shrink-0 rounded-lg sm:block"
        />
        <span className="min-w-0 truncate font-semibold tracking-tight">
          PDF <span className="text-primary">→</span>{' '}
          <span className="sm:hidden">MD</span>
          <span className="hidden sm:inline">Markdown</span>
        </span>
      </Link>
      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <LlmStatusPill />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
