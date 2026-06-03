import { api } from './client'

export interface OllamaStatus {
  online: boolean
  version?: string | null
  error?: string | null
}

export interface OllamaModelDetails {
  parameter_size?: string
  quantization_level?: string
  family?: string
}

export interface OllamaModel {
  name: string
  size: number
  modified_at?: string
  details?: OllamaModelDetails | null
}

export interface LoadedModel {
  name: string
  size_vram?: number | null
}

export const ollamaApi = {
  status: () => api.get<OllamaStatus>('/ollama/status'),
  models: () => api.get<OllamaModel[]>('/ollama/models'),
  loaded: () => api.get<LoadedModel[]>('/ollama/ps'),
  pull: (name: string) => api.post('/ollama/pull', { name }),
  remove: (name: string) => api.del(`/ollama/models/${encodeURIComponent(name)}`),
}
