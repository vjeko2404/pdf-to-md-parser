import i18n from '@/locales/i18n'

/**
 * API-error translation layer (scaffold).
 *
 * Design: the backend attaches a stable machine `code` to each error response (an
 * RFC7807 ProblemDetails extension member). The frontend maps that code to a key in
 * the `apiErrors` translation namespace, so error toasts/messages localize with the UI.
 *
 * STATUS: scaffold. The backend does not emit `code` yet, so {@link translateApiError}
 * currently falls back to the raw English `detail` the server returns — zero regression.
 * Wiring the backend codes + switching call sites to `translateApiError` is the follow-up.
 */

/** The canonical error codes the backend will emit — kept in sync with `en/apiErrors.json`
 *  (dotted path = namespace key path). The exhaustive list also documents the contract. */
export const API_ERROR_CODES = [
  'auth.usernameTooShort',
  'auth.usernameTooLong',
  'auth.passwordTooShort',
  'auth.passwordNoUppercase',
  'auth.passwordNoNumber',
  'auth.passwordNoSymbol',
  'auth.registrationDisabled',
  'auth.usernameTaken',
  'auth.invalidCredentials',
  'auth.accountDisabled',
  'auth.userNotFound',
  'auth.currentPasswordIncorrect',
  'auth.cantChangeOwnActiveState',
  'auth.unsupportedLanguage',
  'documents.noEngine',
  'documents.emptyFile',
  'documents.notPdf',
  'documents.expectedMultipart',
  'documents.notImage',
  'documents.noImages',
  'documents.pdfBuildFailed',
  'documents.contentRequired',
  'documents.enrichFailed',
  'documents.notFound',
  'categories.nameRequired',
  'secrets.keyRequired',
  'ollama.unreachable',
  'ollama.nameRequired',
  'folders.invalidPath',
] as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[number]

/** An Error thrown by the api client, optionally carrying the HTTP status + backend code. */
export interface ApiError extends Error {
  status?: number
  code?: string
}

export function isApiErrorCode(code: string | undefined | null): code is ApiErrorCode {
  return !!code && (API_ERROR_CODES as readonly string[]).includes(code)
}

/** Map a backend error code to its `apiErrors` translation key, or undefined if unknown. */
export function errorKeyFromCode(code: string | undefined | null): string | undefined {
  return isApiErrorCode(code) ? `apiErrors:${code}` : undefined
}

/**
 * Resolve a thrown api error to a user-facing, localized string. Prefers the coded
 * translation (with `params` for interpolation like `{{name}}`/`{{detail}}`); otherwise
 * falls back to the server's raw message, then a generic catch-all.
 */
export function translateApiError(err: unknown, params?: Record<string, unknown>): string {
  const e = err as ApiError | undefined
  const key = errorKeyFromCode(e?.code)
  if (key && i18n.exists(key)) return i18n.t(key, params ?? {})
  return e?.message || i18n.t('apiErrors:unknown')
}
