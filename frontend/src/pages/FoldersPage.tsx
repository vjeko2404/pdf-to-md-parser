import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Folder, FolderUp, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Section } from '@/components/common/Section'
import { Button } from '@/components/ui/Button'
import { foldersApi } from '@/api/folders'
import { usePatchSettings, useSettings } from '@/hooks/useSettings'

export function FoldersPage() {
  const [sub, setSub] = useState('')
  const { data: settings } = useSettings()
  const patch = usePatchSettings()
  const { data } = useQuery({ queryKey: ['folders', sub], queryFn: () => foldersApi.browse(sub) })
  const current = settings?.watchSubdir

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Section title="Watched folder" description={`Currently watching: ${current ?? '…'}`}>
        <div className="mb-3 text-sm text-muted-foreground">
          <span>/host/</span>
          <span className="font-medium text-foreground">{data?.current === '.' ? '' : data?.current}</span>
        </div>
        <ul className="flex flex-col divide-y">
          {data?.parent != null && (
            <li>
              <button
                onClick={() => setSub(data.parent ?? '')}
                className="flex w-full items-center gap-2 py-2 text-left text-muted-foreground"
              >
                <FolderUp className="size-4" /> ..
              </button>
            </li>
          )}
          {data?.dirs.map((d) => (
            <li key={d.sub} className="flex items-center gap-2 py-2">
              <button
                onClick={() => setSub(d.sub)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <Folder className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{d.name}</span>
              </button>
              <Button
                variant={current === d.sub ? 'button_green' : 'ghost'}
                size="sm"
                onClick={() =>
                  patch.mutate(
                    { watchSubdir: d.sub },
                    { onSuccess: () => toast.success(`Now watching ${d.sub}`) },
                  )
                }
              >
                {current === d.sub ? (
                  <>
                    <Check className="size-4" /> Watching
                  </>
                ) : (
                  'Watch this'
                )}
              </Button>
            </li>
          ))}
        </ul>
        {data && data.dirs.length === 0 && (
          <p className="text-sm text-muted-foreground">No subfolders here.</p>
        )}
      </Section>
    </div>
  )
}
