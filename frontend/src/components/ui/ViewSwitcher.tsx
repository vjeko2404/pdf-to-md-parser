import { LayoutGrid, Table as TableIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import type { ViewMode } from '@/hooks/useViewMode'

export function ViewSwitcher({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="flex h-9 items-center gap-0.5 rounded-md border p-px">
      <Tooltip content="Grid" asChild>
        <Button variant={mode === 'grid' ? 'secondary' : 'ghost'} size="icon" onClick={() => onChange('grid')}>
          <LayoutGrid className="size-4" />
        </Button>
      </Tooltip>
      <Tooltip content="Table" asChild>
        <Button variant={mode === 'table' ? 'secondary' : 'ghost'} size="icon" onClick={() => onChange('table')}>
          <TableIcon className="size-4" />
        </Button>
      </Tooltip>
    </div>
  )
}
