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
  retry: (id: number) => api.post(`/documents/${id}/retry`),
  reenrich: (id: number) => api.post<DocumentDto>(`/documents/${id}/reenrich`),
  enrichBatch: (ids: number[]) => api.post('/documents/enrich', { ids }),
  events: (id: number) => api.get<EventDto[]>(`/documents/${id}/events`),
  markdown: (id: number) => api.get<string>(`/documents/${id}/markdown`),
  blocks: (id: number) => api.get<MarkerBlock[]>(`/documents/${id}/blocks`),
  facets: () => api.get<Facets>('/facets'),
  pdfUrl: (id: number) => `/api/documents/${id}/pdf`,
}
