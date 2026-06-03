import { api } from './client'

export type Settings = Record<string, string>

export interface LlmTestResult {
  ok: boolean
  detail?: string | null
}

export const settingsApi = {
  get: () => api.get<Settings>('/settings'),
  patch: (updates: Settings) => api.patch<Settings>('/settings', updates),
  /** Test the currently-selected (saved) LLM provider. */
  llmTest: () => api.get<LlmTestResult>('/settings/llm-test'),
}
