import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { toast } from 'sonner'
import { Section } from '@/components/common/Section'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { usePullModel } from '@/hooks/useOllama'
import { useSignalR } from '@/hooks/useSignalR'

interface PullProgress {
  name: string
  status?: string
  total?: number
  completed?: number
  error?: string
}

export function PullPanel() {
  const [name, setName] = useState('')
  const [progress, setProgress] = useState<PullProgress | null>(null)
  const pull = usePullModel()
  const qc = useQueryClient()

  useSignalR({
    ollamaPull: (p: PullProgress) => {
      setProgress(p)
      if (p.status === 'done') {
        toast.success(`Pulled ${p.name}`)
        qc.invalidateQueries({ queryKey: ['ollama-models'] })
        setProgress(null)
      }
      if (p.status === 'error') {
        toast.error(`Pull failed: ${p.error ?? ''}`)
        setProgress(null)
      }
    },
  })

  const pct =
    progress?.total && progress.total > 0
      ? Math.round(((progress.completed ?? 0) / progress.total) * 100)
      : null

  const start = () => {
    if (!name.trim()) return
    pull.mutate(name.trim())
    setProgress({ name: name.trim(), status: 'starting' })
  }

  return (
    <Section title="Pull a model" description="Download from the Ollama registry">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. qwen2.5:7b-instruct"
          onKeyDown={(e) => e.key === 'Enter' && start()}
        />
        <Button variant="button_primary" size="sm" onClick={start}>
          <Download className="size-4" /> Pull
        </Button>
      </div>
      {progress && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {progress.name} — {progress.status}
            </span>
            {pct != null && <span>{pct}%</span>}
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct ?? 0}%` }} />
          </div>
        </div>
      )}
    </Section>
  )
}
