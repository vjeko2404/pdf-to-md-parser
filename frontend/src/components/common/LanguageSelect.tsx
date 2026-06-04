import { Check, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from '@/components/ui/Popover'
import { Button } from '@/components/ui/Button'
import { setLanguage } from '@/locales/i18n'
import { SUPPORTED, languageOf } from '@/locales/languages'
import { authApi } from '@/api/auth'
import { cn } from '@/lib/utils'

/**
 * Language picker popover. Two persistence modes:
 *  - `local`  — only i18next + localStorage (used pre-auth on the login screen).
 *  - `remote` — also saves to the user's profile (`PATCH /auth/language`) so the
 *    choice survives logout/login across devices.
 */
export function LanguageSelect({
  persist = 'local',
  side = 'bottom',
  align = 'end',
}: {
  persist?: 'local' | 'remote'
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
}) {
  const { t, i18n } = useTranslation('common')
  const current = languageOf(i18n.resolvedLanguage ?? i18n.language)

  const choose = (code: string) => {
    if (code === current.code) return
    setLanguage(code)
    if (persist === 'remote') {
      authApi
        .setLanguage(code)
        .then(() => toast.success(t('common:saved')))
        .catch((e: Error) => toast.error(e.message))
    }
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" aria-label={t('settings:language.title')}>
            <Globe className="size-4" />
            <span>{current.flag}</span>
            <span className="hidden sm:inline">{current.label}</span>
          </Button>
        }
      />
      <PopoverContent side={side} align={align} className="min-w-44 p-1">
        <ul className="flex flex-col">
          {SUPPORTED.map((lang) => (
            <li key={lang.code}>
              <PopoverClose
                render={
                  <button
                    type="button"
                    onClick={() => choose(lang.code)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                      'hover:bg-accent hover:text-accent-foreground',
                      lang.code === current.code && 'font-medium',
                    )}
                  >
                    <span>{lang.flag}</span>
                    <span className="flex-1">{lang.label}</span>
                    {lang.code === current.code && <Check className="size-4 text-primary" />}
                  </button>
                }
              />
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
