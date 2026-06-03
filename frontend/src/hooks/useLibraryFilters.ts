import { useSearchParams } from 'react-router-dom'

/**
 * Library filters backed by the URL query string (?q=&status=&categoryId=&sort=).
 * URL-driven so filtered views are bookmarkable/shareable and deep-linkable — e.g. the
 * Categories page links to `/?categoryId=5`. Search uses history-replace to avoid spamming
 * the back stack on every keystroke.
 */
export function useLibraryFilters() {
  const [params, setParams] = useSearchParams()

  const setParam = (key: string, value: string, replace = false) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace },
    )

  return {
    search: params.get('q') ?? '',
    status: params.get('status') ?? '',
    categoryId: params.get('categoryId') ?? '',
    sort: params.get('sort') ?? '',
    setSearch: (v: string) => setParam('q', v, true),
    setStatus: (v: string) => setParam('status', v),
    setCategoryId: (v: string) => setParam('categoryId', v),
    setSort: (v: string) => setParam('sort', v),
  }
}
