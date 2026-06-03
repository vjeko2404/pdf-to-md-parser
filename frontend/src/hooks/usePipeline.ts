import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { pipelineApi, type PipelineStatus } from '@/api/pipeline'

const KEY = ['pipeline-status']

export function usePipelineStatus() {
  return useQuery({ queryKey: KEY, queryFn: pipelineApi.status })
}

/** Pause/resume the shared processing pipeline. The SignalR `pipelineState` push keeps
 *  other tabs in sync; here we also write the response straight into the cache. */
export function usePipelineControl() {
  const qc = useQueryClient()
  const set = (s: PipelineStatus) => qc.setQueryData(KEY, s)
  const pause = useMutation({ mutationFn: pipelineApi.pause, onSuccess: set })
  const resume = useMutation({ mutationFn: pipelineApi.resume, onSuccess: set })
  return { pause, resume }
}
