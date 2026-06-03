import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { categoriesApi } from '@/api/categories'

export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: categoriesApi.list })
}

function useCategoryMutation<T>(fn: (arg: T) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })
}

export const useCreateCategory = () =>
  useCategoryMutation(({ name, color }: { name: string; color?: string }) =>
    categoriesApi.create(name, color),
  )

export const useUpdateCategory = () =>
  useCategoryMutation(({ id, name, color }: { id: number; name: string; color?: string }) =>
    categoriesApi.update(id, name, color),
  )

export const useDeleteCategory = () =>
  useCategoryMutation((id: number) => categoriesApi.remove(id))

// ── per-document assignment ──────────────────────────────────────────────────

export function useDocCategories(docId: number) {
  return useQuery({
    queryKey: ['doc-categories', docId],
    queryFn: () => categoriesApi.forDocument(docId),
    enabled: Number.isFinite(docId),
  })
}

function useDocCatMutation<T>(docId: number, fn: (arg: T) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc-categories', docId] })
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

export const useAssignCategory = (docId: number) =>
  useDocCatMutation(docId, (categoryId: number) => categoriesApi.assign(docId, categoryId))

export const useUnassignCategory = (docId: number) =>
  useDocCatMutation(docId, (categoryId: number) => categoriesApi.unassign(docId, categoryId))

export const useAutoCategorize = (docId: number) =>
  useDocCatMutation(docId, () => categoriesApi.auto(docId))
