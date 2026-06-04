import { Sun, Moon, Monitor } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { useTheme } from '@/providers/ThemeProvider'

export function ThemeToggle() {
  const { t } = useTranslation('nav')
  const { theme, setTheme } = useTheme()
  const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light'
  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor
  return (
    <Tooltip content={t('theme.tooltip', { theme: t(`theme.${theme}`) })} asChild>
      <Button variant="ghost" size="icon" onClick={() => setTheme(next)}>
        <Icon className="size-4" />
      </Button>
    </Tooltip>
  )
}
