import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { Section } from '@/components/common/Section'
import { Button } from '@/components/ui/Button'
import { TextArea } from '@/components/common/inputs'

export function PromptPanel({
  value,
  onSave,
  title = 'Enrichment prompt',
  description = 'System prompt for extracting tags, type & metadata',
}: {
  value: string
  onSave: (v: string) => void
  title?: string
  description?: string
}) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])

  return (
    <Section
      title={title}
      description={description}
      action={
        <Button
          variant="button_primary"
          size="sm"
          onClick={() => {
            onSave(draft)
            toast.success('Prompt saved')
          }}
        >
          <Save className="size-4" /> Save
        </Button>
      }
    >
      <TextArea rows={6} value={draft} onChange={(e) => setDraft(e.target.value)} />
    </Section>
  )
}
