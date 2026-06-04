import { useTranslation } from 'react-i18next'
import { Section } from '@/components/common/Section'
import { LanguageSelect } from '@/components/common/LanguageSelect'

/** Settings section letting the signed-in user pick their UI language. The choice is
 *  saved to their profile (`PATCH /auth/language`) so it persists across logins. */
export function LanguagePanel() {
  const { t } = useTranslation('settings')
  return (
    <Section title={t('language.title')} description={t('language.description')}>
      <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <p className="text-sm font-medium">{t('language.label')}</p>
        <LanguageSelect persist="remote" align="end" />
      </div>
    </Section>
  )
}
