import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { Section } from '@/components/common/Section'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'

export function PromptPanel({
  value,
  onSave,
  title,
  description,
}: {
  value: string
  onSave: (v: string) => void
  title: string
  description: string
}) {
  const { t } = useTranslation('ai')
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
            toast.success(t('prompt.saved'))
          }}
        >
          <Save className="size-4" /> {t('common:save')}
        </Button>
      }
    >
      <Textarea rows={6} value={draft} onChange={(e) => setDraft(e.target.value)} />
    </Section>
  )
}
