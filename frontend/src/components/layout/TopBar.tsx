import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from './ThemeToggle'
import { OllamaStatusPill } from './OllamaStatusPill'

export function TopBar({ isMobile, onMenu }: { isMobile: boolean; onMenu: () => void }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-card px-4">
      {isMobile && (
        <Button variant="ghost" size="icon" onClick={onMenu}>
          <Menu className="size-5" />
        </Button>
      )}
      <span className="font-semibold tracking-tight">
        PDF <span className="text-primary">→</span> Markdown
      </span>
      <div className="ml-auto flex items-center gap-2">
        <OllamaStatusPill />
        <ThemeToggle />
      </div>
    </header>
  )
}
