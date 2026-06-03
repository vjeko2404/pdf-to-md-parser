import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from './ThemeToggle'
import { LlmStatusPill } from './LlmStatusPill'
import { UserMenu } from './UserMenu'

export function TopBar({ isMobile, onMenu }: { isMobile: boolean; onMenu: () => void }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 overflow-hidden border-b bg-card px-3 sm:gap-3 sm:px-4">
      {isMobile && (
        <Button variant="ghost" size="icon" onClick={onMenu} className="shrink-0">
          <Menu className="size-5" />
        </Button>
      )}
      <span className="min-w-0 truncate font-semibold tracking-tight">
        PDF <span className="text-primary">→</span> Markdown
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
        <LlmStatusPill />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  )
}
