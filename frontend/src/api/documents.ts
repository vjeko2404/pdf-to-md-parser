import { api } from './client'
import type { DocumentDto, EventDto } from '@/types/api'

export interface DocumentQuery {
  q?: string
  status?: string
  tags?: string // comma-separated
  docType?: string
  language?: string
  dateFrom?: string
  dateTo?: string
  categoryId?: number
  sort?: string
}

export interface MarkerBlock {
  id: string
  page: number
  bbox?: number[] | null
  type: string
}

export interface Facet {
  value: string
  count: number
}

export interface Facets {
  docTypes: Facet[]
  languages: Facet[]
  tags: Facet[]
}

export interface EnrichResult {
  id: number
  ok: boolean
  error?: string | null
}

export const documentsApi = {
  list: (query: DocumentQuery = {}) => {
    const entries = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)] as [string, string])
    const qs = new URLSearchParams(entries).toString()
    return api.get<DocumentDto[]>(`/documents${qs ? `?${qs}` : ''}`)
  },
  get: (id: number) => api.get<DocumentDto>(`/documents/${id}`),
  upload: (file: File) => api.upload<DocumentDto>('/documents/upload', file),
  /** Mobile "scan": ordered (already-compressed) images → one multi-page PDF, built server-side. */
  uploadPhotos: (blobs: Blob[]) => {
    const fd = new FormData()
    blobs.forEach((b, i) => fd.append('files', b, `page-${i + 1}.jpg`))
    return api.postForm<DocumentDto>('/documents/upload-photos', fd)
  },
  retry: (id: number) => api.post(`/documents/${id}/retry`),
  reconvert: (id: number) => api.post(`/documents/${id}/reconvert`),
  /** Rename (display name) and/or replace the category set in one call. */
  update: (id: number, body: { originalName?: string; categoryIds?: number[] }) =>
    api.patch<DocumentDto>(`/documents/${id}`, body),
  remove: (id: number) => api.del<void>(`/documents/${id}`),
  removeBatch: (ids: number[]) => api.post<{ deleted: number }>('/documents/delete', { ids }),
  reenrich: (id: number) => api.post<DocumentDto>(`/documents/${id}/reenrich`),
  updateTags: (id: number, tags: string[]) =>
    api.patch<DocumentDto>(`/documents/${id}/tags`, { tags }),
  enrichBatch: (ids: number[]) => api.post<EnrichResult[]>('/documents/enrich', { ids }),
  events: (id: number) => api.get<EventDto[]>(`/documents/${id}/events`),
  markdown: (id: number) => api.get<string>(`/documents/${id}/markdown`),
  blocks: (id: number) => api.get<MarkerBlock[]>(`/documents/${id}/blocks`),
  facets: () => api.get<Facets>('/facets'),
  /** Fetch the archived PDF as a Blob WITH auth — callers wrap it in an object URL.
   *  (A bare URL can't be used: PDF.js/iframe/anchor send no Authorization header → 401.) */
  pdfBlob: (id: number) => api.blob(`/documents/${id}/pdf`),
}
