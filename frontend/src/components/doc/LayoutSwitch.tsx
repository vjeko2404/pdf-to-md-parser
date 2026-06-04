import { Columns2, File, FileText } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'

export type DocLayout = 'split' | 'pdf' | 'md'

const MODES: { value: DocLayout; icon: typeof File; title: string }[] = [
  { value: 'pdf', icon: File, title: 'PDF only' },
  { value: 'split', icon: Columns2, title: 'Side by side' },
  { value: 'md', icon: FileText, title: 'Markdown only' },
]

export function LayoutSwitch({
  value,
  onChange,
}: {
  value: DocLayout
  onChange: (v: DocLayout) => void
}) {
  return (
    <div className="flex gap-0.5 rounded-md border p-0.5">
      {MODES.map(({ value: v, icon: Icon, title }) => (
        <Tooltip key={v} content={title} asChild>
          <Button
            variant={value === v ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => onChange(v)}
          >
            <Icon className="size-4" />
          </Button>
        </Tooltip>
      ))}
    </div>
  )
}
