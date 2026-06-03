import { api } from './client'

export type Settings = Record<string, string>

export interface LlmTestResult {
  ok: boolean
  detail?: string | null
}

export interface MarkerTestResult {
  ok: boolean
  detail: string
}

/** Live conversion-engine state for the caller (GET /api/conversion/status). */
export interface ConversionStatus {
  engine: string
  markerUrl: string
  healthy: boolean | null
}

export const settingsApi = {
  get: () => api.get<Settings>('/settings'),
  patch: (updates: Settings) => api.patch<Settings>('/settings', updates),
  /** Test the currently-selected (saved) LLM provider. */
  llmTest: () => api.get<LlmTestResult>('/settings/llm-test'),
  /** Model ids for the active provider (for the model picker). */
  llmModels: () => api.get<string[]>('/settings/llm-models'),
  /** Probe a marker server URL (draft value, like the Ollama test). */
  markerTest: (url: string) =>
    api.get<MarkerTestResult>(`/settings/marker-test?url=${encodeURIComponent(url)}`),
  /** Current engine + live marker reachability. */
  conversionStatus: () => api.get<ConversionStatus>('/conversion/status'),
}
