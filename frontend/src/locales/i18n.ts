import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { resources } from './resources'
import { NAMESPACES } from './en'
import { DEFAULT_LANGUAGE, isSupported } from './languages'

export const LANG_STORAGE_KEY = 'pdfmd-lang'

/** Resolve the initial language: a persisted choice wins, otherwise English.
 *  After login, AuthProvider may override this with the user's saved preference. */
function initialLanguage(): string {
  const stored = localStorage.getItem(LANG_STORAGE_KEY)
  return isSupported(stored) ? stored : DEFAULT_LANGUAGE
}

i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  ns: NAMESPACES,
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React already escapes
  returnNull: false,
})

/** Change the active language and remember it for next load. */
export function setLanguage(code: string) {
  if (!isSupported(code)) return
  localStorage.setItem(LANG_STORAGE_KEY, code)
  void i18n.changeLanguage(code)
}

export default i18n
