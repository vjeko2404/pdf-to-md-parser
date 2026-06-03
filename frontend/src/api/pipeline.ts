import { api } from './client'

export interface PipelineStatus {
  paused: boolean
}

export const pipelineApi = {
  status: () => api.get<PipelineStatus>('/pipeline/status'),
  pause: () => api.post<PipelineStatus>('/pipeline/pause'),
  resume: () => api.post<PipelineStatus>('/pipeline/resume'),
}
