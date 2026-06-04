import { useState } from 'react'
import { Tag as TagIcon, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Tooltip } from '@/components/ui/Tooltip'
import { useUpdateTags } from '@/hooks/useDocuments'

export function TagBar({ docId, tags }: { docId: number; tags: string[] }) {
  const { t } = useTranslation('document')
  const update = useUpdateTags(docId)
  const [draft, setDraft] = useState('')

  const add = () => {
    const tag = draft.trim()
    if (!tag) return
    setDraft('')
    if (tags.some((x) => x.toLowerCase() === tag.toLowerCase())) return
    update.mutate([...tags, tag], { onError: (e) => toast.error(e.message) })
  }

  const remove = (tag: string) =>
    update.mutate(
      tags.filter((x) => x !== tag),
      { onError: (e) => toast.error(e.message) },
    )

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <TagIcon className="size-3.5 shrink-0 text-muted-foreground" />
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
        >
          {tag}
          <Tooltip content={t('tag.removeTooltip')} asChild>
            <button
              type="button"
              onClick={() => remove(tag)}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="size-3" />
            </button>
          </Tooltip>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add()
          }
        }}
        onBlur={add}
        placeholder={t('tag.addPlaceholder')}
        className="h-7 w-24 rounded-md border bg-background px-2 text-xs outline-none transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  )
}
