import { api } from './client'

export interface SecretInfo {
  key: string
  masked: string
  updatedAt: string
}

export const secretsApi = {
  list: () => api.get<SecretInfo[]>('/secrets'),
  reveal: (key: string) => api.get<{ key: string; value: string }>(`/secrets/${encodeURIComponent(key)}/reveal`),
  set: (key: string, value: string) => api.put('/secrets', { key, value }),
  remove: (key: string) => api.del(`/secrets/${encodeURIComponent(key)}`),
}
