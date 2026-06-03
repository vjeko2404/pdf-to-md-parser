import { useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { Section } from '@/components/common/Section'
import { Button } from '@/components/ui/Button'
import { TextArea } from '@/components/common/inputs'

export function PromptPanel({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])

  return (
    <Section
      title="Enrichment prompt"
      description="System prompt sent to Ollama for tagging & summaries"
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
