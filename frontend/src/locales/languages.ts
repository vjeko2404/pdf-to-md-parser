/** The single source of truth for which languages the app ships.
 *  Add a new language here, drop a sibling folder under `locales/<code>/`, and
 *  register it in `resources.ts` — selectors and validation pick it up automatically. */
export interface Language {
  code: string
  /** Native label shown in the selector (e.g. "Deutsch"). */
  label: string
  /** Emoji flag for a compact visual cue. */
  flag: string
}

export const SUPPORTED: Language[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'hr', label: 'Hrvatski', flag: '🇭🇷' },
]

export const DEFAULT_LANGUAGE = 'en'

/** The codes the backend will accept for `users.DefaultLanguage`. */
export const SUPPORTED_CODES = SUPPORTED.map((l) => l.code)

export function isSupported(code: string | null | undefined): code is string {
  return !!code && SUPPORTED_CODES.includes(code)
}

export function languageOf(code: string | null | undefined): Language {
  return SUPPORTED.find((l) => l.code === code) ?? SUPPORTED[0]
}
