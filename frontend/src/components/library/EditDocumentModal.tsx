import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { TextInput } from '@/components/common/inputs'
import { useUpdateDocument } from '@/hooks/useDocuments'
import type { Category } from '@/api/categories'
import type { DocumentDto } from '@/types/api'

export interface EditDocumentModalProps {
  /** The document being edited; null closes the modal. */
  doc: DocumentDto | null
  categories: Category[]
  onClose: () => void
}

/** Rename a document (display name) and adjust its categories in one place. */
export function EditDocumentModal({ doc, categories, onClose }: EditDocumentModalProps) {
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const update = useUpdateDocument()

  // Re-seed the form whenever a different document is opened.
  useEffect(() => {
    if (!doc) return
    setName(doc.originalName)
    setSelected(new Set((doc.categories ?? []).map((c) => c.id)))
  }, [doc])

  if (!doc) return null

  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error('Name cannot be empty')
      return
    }
    update.mutate(
      { id: doc.id, originalName: trimmed, categoryIds: [...selected] },
      {
        onSuccess: () => {
          toast.success('Saved')
          onClose()
        },
        onError: (e) => toast.error(e.message),
      },
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Edit document"
        className="w-full max-w-md rounded-xl border bg-card p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold">Edit document</h2>

        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Filename
        </label>
        <TextInput
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Document name"
          className="mt-1"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />

        <label className="mt-4 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Categories
        </label>
        <div className="mt-1 flex max-h-56 flex-col gap-1 overflow-y-auto rounded-md border p-2">
          {categories.length === 0 && (
            <p className="px-1 py-2 text-sm text-muted-foreground">No categories yet.</p>
          )}
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              className="flex items-center gap-2 rounded-md px-1 py-1 text-left text-sm transition-colors hover:bg-accent/60"
            >
              <Checkbox checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ background: c.color ?? 'var(--muted-foreground)' }}
              />
              <span className="flex-1 truncate">{c.name}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="button_neutral" size="sm" onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button variant="button_primary" size="sm" onClick={save} disabled={update.isPending}>
            {update.isPending && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
