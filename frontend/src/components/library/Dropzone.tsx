import { useDropzone } from 'react-dropzone'
import { UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useUploadDocument } from '@/hooks/useDocuments'

export function Dropzone() {
  const upload = useUploadDocument()

  const onDrop = (files: File[]) => {
    for (const file of files) {
      upload.mutate(file, {
        onSuccess: () => toast.success(`Uploaded ${file.name}`),
        onError: (e) => toast.error(`Failed: ${file.name}`, { description: String(e) }),
      })
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
  })

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
