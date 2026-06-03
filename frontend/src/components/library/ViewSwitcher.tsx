import { LayoutGrid, Table as TableIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { ViewMode } from '@/hooks/useViewMode'

export function ViewSwitcher({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="flex gap-0.5 rounded-md border p-0.5">
      <Button variant={mode === 'grid' ? 'secondary' : 'ghost'} size="icon" onClick={() => onChange('grid')} title="Grid">
        <LayoutGrid className="size-4" />
      </Button>
      <Button variant={mode === 'table' ? 'secondary' : 'ghost'} size="icon" onClick={() => onChange('table')} title="Table">
        <TableIcon className="size-4" />
      </Button>
    </div>
  )
}
