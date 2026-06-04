import { useTranslation } from 'react-i18next'
import { Check, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Section } from '@/components/common/Section'
import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { cn } from '@/lib/utils'
import { useLoadedModels, useOllamaModels, useRemoveModel } from '@/hooks/useOllama'

export function ModelsPanel({
  activeModel,
  onSelect,
}: {
  activeModel?: string
  onSelect: (model: string) => void
}) {
  const { t } = useTranslation('ai')
  const { data: models, isError } = useOllamaModels()
  const { data: loaded } = useLoadedModels()
  const remove = useRemoveModel()
  const loadedNames = new Set((loaded ?? []).map((m) => m.name))

  return (
    <Section title={t('models.title')} description={t('models.description')}>
      {isError ? (
        <p className="text-sm text-muted-foreground">{t('models.unreachable')}</p>
      ) : !models?.length ? (
        <p className="text-sm text-muted-foreground">{t('models.none')}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {models.map((m) => (
            <li key={m.name} className="flex items-center gap-2 py-2">
              <button
                onClick={() => onSelect(m.name)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <Check
                  className={cn('size-4 shrink-0 text-primary', activeModel === m.name ? '' : 'opacity-0')}
                />
                <span className="truncate font-medium">{m.name}</span>
                {m.details?.parameter_size && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {m.details.parameter_size} · {m.details.quantization_level}
                  </span>
                )}
                {loadedNames.has(m.name) && (
                  <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                    {t('models.loaded')}
                  </span>
                )}
              </button>
              <Tooltip content={t('models.deleteTooltip')} asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    remove.mutate(m.name, {
                      onSuccess: () => toast.success(t('models.removed', { name: m.name })),
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
