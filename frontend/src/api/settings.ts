import { api } from './client'

export type Settings = Record<string, string>

export const settingsApi = {
  get: () => api.get<Settings>('/settings'),
  patch: (updates: Settings) => api.patch<Settings>('/settings', updates),
}
