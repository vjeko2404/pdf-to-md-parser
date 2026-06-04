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
export const useUploadPhotos = () => useInvalidatingMutation((blobs: Blob[]) => documentsApi.uploadPhotos(blobs))
export const useReenrich = () => useInvalidatingMutation((id: number) => documentsApi.reenrich(id))
export const useRetry = () => useInvalidatingMutation((id: number) => documentsApi.retry(id))
export const useReconvert = () => useInvalidatingMutation((id: number) => documentsApi.reconvert(id))
export const useEnrichBatch = () => useInvalidatingMutation((ids: number[]) => documentsApi.enrichBatch(ids))
export const useDeleteDocument = () => useInvalidatingMutation((id: number) => documentsApi.remove(id))

export function useUpdateTags(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (tags: string[]) => documentsApi.updateTags(id, tags),
    onSuccess: (doc) => {
      qc.setQueryData(['document', id], doc)
      qc.invalidateQueries({ queryKey: KEY })
    },
  })
}
export const useDeleteBatch = () => useInvalidatingMutation((ids: number[]) => documentsApi.removeBatch(ids))

/** Overwrite a document's Markdown. Refreshes the rendered MD query so the edit shows
 *  immediately, and the list (FTS search content changed). */
export function useUpdateMarkdown(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => documentsApi.updateMarkdown(id, content),
    onSuccess: (doc) => {
      qc.setQueryData(['document', id], doc) // refresh the "edited" badge immediately
      qc.invalidateQueries({ queryKey: ['document-md', id] })
      qc.invalidateQueries({ queryKey: KEY })
    },
  })
}

/** Rename and/or replace a document's categories. Refreshes the list, detail, and the
 *  per-doc category query so every view stays consistent. */
export function useUpdateDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: number
      originalName?: string
      categoryIds?: number[]
    }) => documentsApi.update(id, body),
    onSuccess: (doc, { id }) => {
      qc.setQueryData(['document', id], doc)
      qc.invalidateQueries({ queryKey: KEY })
      qc.invalidateQueries({ queryKey: ['doc-categories', id] })
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}
