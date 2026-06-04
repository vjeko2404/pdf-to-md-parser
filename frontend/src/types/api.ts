export type DocumentStatus = 'Queued' | 'Processing' | 'Done' | 'Failed' | 'Skipped'

/** Category as carried inline on a document (list + detail responses). */
export interface DocCategory {
  id: number
  name: string
  color?: string | null
}

export interface DocumentDto {
  id: number
  sha256: string
  originalName: string
  slug: string
  status: DocumentStatus
  mdPath?: string | null
  archivedPdfPath?: string | null
  layoutJsonPath?: string | null
  pages: number
  language?: string | null
  docType?: string | null
  docDate?: string | null
  docNumber?: string | null
  partiesJson?: string | null
  tagsJson?: string | null
  summary?: string | null
  errorReason?: string | null
  durationMs: number
  createdAt: string
  processedAt?: string | null
  /** Set when the Markdown was manually edited (cleared on reconvert); null = never edited. */
  markdownEditedAt?: string | null
  categories?: DocCategory[]
}

export interface EventDto {
  id: number
  documentId: number
  ts: string
  level: string
  stage: string
  message: string
}

/** Parse the JSON-encoded tags column into a string array (safe). */
export function parseTags(json?: string | null): string[] {
  if (!json) return []
  try {
    const v = JSON.parse(json)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}
