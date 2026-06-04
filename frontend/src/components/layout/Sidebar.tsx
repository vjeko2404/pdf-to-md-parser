import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ButtonVariants } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { NAV } from './nav'

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation('nav')
  return (
    <nav className="flex h-full w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r bg-card p-3">
      {NAV.map(({ to, labelKey, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              ButtonVariants({ variant: 'sidebar' }),
              isActive && 'bg-secondary text-secondary-foreground border-border shadow-sm',
            )
          }
        >
          <Icon className="size-4" />
          <span>{t(labelKey)}</span>
        </NavLink>
      ))}
    </nav>
  )
}
