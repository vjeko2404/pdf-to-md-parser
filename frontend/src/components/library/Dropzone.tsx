import { memo, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Link } from 'react-router-dom'
import { UploadCloud, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useUploadDocument } from '@/hooks/useDocuments'
import { useSettings } from '@/hooks/useSettings'

// memo'd + propless: while a document is processing, the Library page re-renders on every
// SignalR `documentUpdated` (it invalidates the documents query). Those re-renders used to
// reach the dropzone mid-drag and drop its drag-hover state, so drag-and-drop appeared dead
// while click-to-browse still worked. Isolating it here keeps drag working during processing.
function DropzoneImpl() {
  const upload = useUploadDocument()
  const { data: settings } = useSettings()
  const engine = settings?.conversionEngine ?? 'off'
  const off = engine === 'off' || engine === ''

  // Stable identity (upload.mutate is referentially stable in react-query) so the dropzone's
  // event handlers don't churn.
  const onDrop = useCallback(
    (files: File[]) => {
      for (const file of files) {
        upload.mutate(file, {
          onSuccess: () => toast.success(`Uploaded ${file.name}`),
          onError: (e) => toast.error(`Failed: ${file.name}`, { description: String(e) }),
        })
      }
    },
    [upload.mutate],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    disabled: off,
  })

  // No conversion engine selected → uploads are rejected by the server. Make that obvious
  // and point at Settings instead of letting the user hit a 409.
  if (off)
    return (
      <Link
        to="/settings"
        className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-accent/50"
      >
        <Settings className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">No conversion engine selected</p>
        <p className="text-xs text-muted-foreground">
          Pick a conversion engine in Settings before uploading PDFs.
        </p>
      </Link>
    )

  return (
    <div
      {...getRootProps()}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
        isDragActive
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50 hover:bg-accent/50',
      )}
    >
      <input {...getInputProps()} />
      <UploadCloud className={cn('size-8', isDragActive ? 'text-primary' : 'text-muted-foreground')} />
      <p className="text-sm font-medium">
        {isDragActive ? 'Drop the PDF here' : 'Drag & drop PDFs here, or click to browse'}
      </p>
      <p className="text-xs text-muted-foreground">
        {upload.isPending ? 'Uploading…' : 'They’ll be converted to Markdown automatically'}
      </p>
    </div>
  )
}

export const Dropzone = memo(DropzoneImpl)
