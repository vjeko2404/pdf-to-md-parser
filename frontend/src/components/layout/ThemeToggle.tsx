import { Sun, Moon, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { useTheme } from '@/providers/ThemeProvider'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  return (
    <Tooltip content={`Theme: ${theme}`} asChild>
      <Button variant="ghost" size="icon" onClick={() => setTheme(next)}>
        <Icon className="size-4" />
      </Button>
    </Tooltip>
  )
}
