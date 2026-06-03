import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { settingsApi, type Settings } from '@/api/settings'

export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: settingsApi.get })
}

export function usePatchSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (updates: Settings) => settingsApi.patch(updates),
    onSuccess: (data) => qc.setQueryData(['settings'], data),
  })
}
