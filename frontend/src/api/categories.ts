import { api } from './client'

export interface Category {
  id: number
  name: string
  color?: string | null
  createdAt: string
  count?: number
}

export const categoriesApi = {
  list: () => api.get<Category[]>('/categories'),
  create: (name: string, color?: string) => api.post<{ id: number }>('/categories', { name, color }),
  update: (id: number, name: string, color?: string) => api.patch(`/categories/${id}`, { name, color }),
  remove: (id: number) => api.del(`/categories/${id}`),
  forDocument: (docId: number) => api.get<Category[]>(`/documents/${docId}/categories`),
  assign: (docId: number, categoryId: number) => api.post(`/documents/${docId}/categories`, { categoryId }),
  unassign: (docId: number, categoryId: number) => api.del(`/documents/${docId}/categories/${categoryId}`),
  auto: (docId: number) => api.post<{ assigned: string[] }>(`/documents/${docId}/categories/auto`),
}
