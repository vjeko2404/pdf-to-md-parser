import { useState } from 'react'

export type ViewMode = 'grid' | 'table'

export function useViewMode(key = 'library-view') {
  const [mode, setMode] = useState<ViewMode>(
    () => (localStorage.getItem(key) as ViewMode | null) ?? 'grid',
  )
  const set = (m: ViewMode) => {
    localStorage.setItem(key, m)
    setMode(m)
  }
  return [mode, set] as const
}
