import { Sun, Moon, Monitor } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useTheme } from '@/providers/ThemeProvider'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(next)} title={`Theme: ${theme}`}>
      <Icon className="size-4" />
    </Button>
  )
}
