import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { documentsApi, type DocumentQuery } from '@/api/documents'

const KEY = ['documents']

export function useDocuments(query: DocumentQuery) {
  return useQuery({
    queryKey: [...KEY, query],
    queryFn: () => documentsApi.list(query),
  })
}

function useInvalidatingMutation<TArg>(fn: (arg: TArg) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export const useUploadDocument = () => useInvalidatingMutation((file: File) => documentsApi.upload(file))
export const useReenrich = () => useInvalidatingMutation((id: number) => documentsApi.reenrich(id))
export const useRetry = () => useInvalidatingMutation((id: number) => documentsApi.retry(id))
export const useEnrichBatch = () => useInvalidatingMutation((ids: number[]) => documentsApi.enrichBatch(ids))
