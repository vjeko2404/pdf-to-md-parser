/** EU-style date/time formatting (dd.mm.yyyy). Centralised so the whole app stays consistent. */

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value == null) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

const p2 = (n: number) => String(n).padStart(2, '0')

/** dd.mm.yyyy */
export function formatDate(value: string | number | Date | null | undefined): string {
  const d = toDate(value)
  if (!d) return '—'
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`
}

/** dd.mm.yyyy HH:mm */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  const d = toDate(value)
  if (!d) return '—'
  return `${formatDate(d)} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

/** HH:mm:ss */
export function formatTime(value: string | number | Date | null | undefined): string {
  const d = toDate(value)
  if (!d) return '—'
  return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`
}

/** Humanize an LLM-generated doc_type (e.g. "register_extract" -> "Register Extract").
 *  Display-only — the raw value stays the source of truth for filtering/facets. */
export function formatDocType(docType?: string | null): string {
  if (!docType) return '—'
  return docType
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}
