import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ollamaApi } from '@/api/ollama'

export function useOllamaStatus() {
  return useQuery({ queryKey: ['ollama-status'], queryFn: ollamaApi.status, refetchInterval: 10_000 })
}

export function useOllamaModels() {
  return useQuery({ queryKey: ['ollama-models'], queryFn: ollamaApi.models, retry: false })
}

export function useLoadedModels() {
  return useQuery({
    queryKey: ['ollama-ps'],
    queryFn: ollamaApi.loaded,
    refetchInterval: 5_000,
    retry: false,
  })
}

export function usePullModel() {
  return useMutation({ mutationFn: (name: string) => ollamaApi.pull(name) })
}

export function useRemoveModel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => ollamaApi.remove(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ollama-models'] }),
  })
}
