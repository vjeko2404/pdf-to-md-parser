import { Columns2, File, FileText } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'

export type DocLayout = 'split' | 'pdf' | 'md'

const MODES: { value: DocLayout; icon: typeof File; titleKey: string }[] = [
  { value: 'pdf', icon: File, titleKey: 'layout.pdfOnly' },
  { value: 'split', icon: Columns2, titleKey: 'layout.sideBySide' },
  { value: 'md', icon: FileText, titleKey: 'layout.markdownOnly' },
]

export function LayoutSwitch({
  value,
  onChange,
}: {
  value: DocLayout
  onChange: (v: DocLayout) => void
}) {
  const { t } = useTranslation('document')
  return (
    <div className="flex gap-0.5 rounded-md border p-0.5">
      {MODES.map(({ value: v, icon: Icon, titleKey }) => (
        <Tooltip key={v} content={t(titleKey)} asChild>
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
