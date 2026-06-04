/** The i18next `resources` map. English is the canonical base; German and Croatian
 *  mirror the `en/` folder with translated values. Missing keys fall back to `en`
 *  via i18next's `fallbackLng`. */
import en from './en'
import de from './de'
import hr from './hr'

export const resources = {
  en,
  de,
  hr,
} as const

export default resources
