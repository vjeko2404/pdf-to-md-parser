import { api } from './client'

export interface BrowseEntry {
  name: string
  sub: string
}

export interface BrowseResult {
  root: string
  current: string
  parent: string | null
  dirs: BrowseEntry[]
}

export const foldersApi = {
  browse: (sub?: string) =>
    api.get<BrowseResult>(`/folders/browse${sub ? `?sub=${encodeURIComponent(sub)}` : ''}`),
}
