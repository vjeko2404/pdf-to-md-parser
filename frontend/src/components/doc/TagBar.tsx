import { useState } from 'react'
import { Tag as TagIcon, X } from 'lucide-react'
import { toast } from 'sonner'
import { useUpdateTags } from '@/hooks/useDocuments'

export function TagBar({ docId, tags }: { docId: number; tags: string[] }) {
  const update = useUpdateTags(docId)
  const [draft, setDraft] = useState('')

  const add = () => {
    const t = draft.trim()
    if (!t) return
    setDraft('')
    if (tags.some((x) => x.toLowerCase() === t.toLowerCase())) return
    update.mutate([...tags, t], { onError: (e) => toast.error(e.message) })
  }

  const remove = (tag: string) =>
    update.mutate(
      tags.filter((t) => t !== tag),
      { onError: (e) => toast.error(e.message) },
    )

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <TagIcon className="size-3.5 shrink-0 text-muted-foreground" />
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
        >
          {t}
          <button
            type="button"
            onClick={() => remove(t)}
            title="Remove tag"
            className="text-muted-foreground hover:text-destructive"
          >
            <X className="size-3" />
          </button>
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
        placeholder="+ tag"
        className="h-7 w-24 rounded-md border bg-background px-2 text-xs outline-none transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  )
}
