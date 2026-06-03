import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { secretsApi } from '@/api/secrets'

export function useSecrets() {
  return useQuery({ queryKey: ['secrets'], queryFn: secretsApi.list })
}

export function useSetSecret() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => secretsApi.set(key, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['secrets'] }),
  })
}

export function useDeleteSecret() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (key: string) => secretsApi.remove(key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['secrets'] }),
  })
}
