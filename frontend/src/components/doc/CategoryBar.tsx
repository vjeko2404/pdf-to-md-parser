import { Sparkles, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import {
  useAssignCategory,
  useAutoCategorize,
  useCategories,
  useDocCategories,
  useUnassignCategory,
} from '@/hooks/useCategories'

export function CategoryBar({ docId }: { docId: number }) {
  const { data: all = [] } = useCategories()
  const { data: assigned = [] } = useDocCategories(docId)
  const assign = useAssignCategory(docId)
  const unassign = useUnassignCategory(docId)
  const auto = useAutoCategorize(docId)

  const assignedIds = new Set(assigned.map((c) => c.id))
  const available = all.filter((c) => !assignedIds.has(c.id))

  return (
    <div className="flex flex-wrap items-center gap-2">
      {assigned.map((c) => (
        <span
          key={c.id}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
        >
          <span
            className="size-2 rounded-full"
            style={{ background: c.color ?? 'var(--muted-foreground)' }}
          />
          {c.name}
          <button
            onClick={() => unassign.mutate(c.id)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {available.length > 0 && (
        <select
          value=""
          onChange={(e) => e.target.value && assign.mutate(Number(e.target.value))}
          className="h-7 rounded-md border bg-background px-2 text-xs outline-none"
        >
          <option value="">+ category</option>
          {available.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={() =>
          auto.mutate(undefined, {
            onSuccess: (r) => {
              const names = (r as { assigned: string[] }).assigned
              toast.success(names.length ? `Auto: ${names.join(', ')}` : 'No category matched')
            },
            onError: (e) => toast.error(e.message),
          })
        }
        title="Auto-categorize with the LLM"
      >
        <Sparkles className="size-4" /> Auto
      </Button>
    </div>
  )
}
