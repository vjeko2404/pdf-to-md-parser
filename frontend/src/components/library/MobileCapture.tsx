import { useEffect, useRef, useState } from "react";
import { Camera, ChevronDown, ChevronUp, FileUp, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { compressImage } from "@/lib/compressImage";
import { useUploadPhotos } from "@/hooks/useDocuments";

interface Shot {
  id: string;
  file: File;
  url: string;
}

let counter = 0;
const nextId = () => `shot-${counter++}`;

/**
 * Mobile-only "scan with camera" flow: snap one or more photos (the rear camera via
 * `capture`), reorder/remove them, then ship the ordered set to the backend which stitches
 * them into a multi-page PDF and runs the normal pipeline. Photos are downscaled + JPEG-
 * re-encoded client-side first so a phone's 5–8 MB shots don't bloat the upload.
 */
export function MobileCapture() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [shots, setShots] = useState<Shot[]>([]);
  const upload = useUploadPhotos();

  // Revoke object URLs on unmount to avoid leaks.
  useEffect(
    () => () => {
      shots.forEach((s) => URL.revokeObjectURL(s.url));
    },
    [shots],
  );

  const add = (files: FileList | null) => {
    if (!files?.length) return;
    const next = Array.from(files).map((file) => ({
      id: nextId(),
      file,
      url: URL.createObjectURL(file),
    }));
    setShots((s) => [...s, ...next]);
  };

  const remove = (id: string) =>
    setShots((s) => {
      const target = s.find((x) => x.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return s.filter((x) => x.id !== id);
    });

  const move = (index: number, delta: number) =>
    setShots((s) => {
      const j = index + delta;
      if (j < 0 || j >= s.length) return s;
      const next = [...s];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });

  const submit = async () => {
    if (shots.length === 0) return;
    let blobs: Blob[];
    try {
      blobs = await Promise.all(shots.map((s) => compressImage(s.file)));
    } catch (e) {
      toast.error("Could not process the photos", { description: String(e) });
      return;
    }
    upload.mutate(blobs, {
      onSuccess: () => {
        toast.success(`Scanned ${shots.length} page(s) → PDF queued`);
        shots.forEach((s) => URL.revokeObjectURL(s.url));
        setShots([]);
      },
      onError: (e) => toast.error("Upload failed", { description: String(e) }),
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={(e) => {
          add(e.target.files);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />

      <div className="flex items-center gap-2">
        <Camera className="size-5 text-muted-foreground" />
        <span className="text-sm font-medium">Scan a document with the camera</span>
      </div>

      {shots.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {shots.map((s, i) => (
            <div key={s.id} className="group relative overflow-hidden rounded-lg border">
              <img src={s.url} alt={`page ${i + 1}`} className="aspect-3/4 w-full object-cover" />
              <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-xs text-white">
                {i + 1}
              </span>
              <div className="absolute right-1 top-1 flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  title="Remove"
                  className="rounded bg-black/60 p-0.5 text-white hover:bg-destructive">
                  <X className="size-3.5" />
                </button>
              </div>
              <div className="absolute bottom-1 right-1 flex gap-0.5">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  title="Move earlier"
                  className="rounded bg-black/60 p-0.5 text-white hover:bg-primary disabled:opacity-30">
                  <ChevronUp className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === shots.length - 1}
                  title="Move later"
                  className="rounded bg-black/60 p-0.5 text-white hover:bg-primary disabled:opacity-30">
                  <ChevronDown className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          variant="button_neutral"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}>
          <Camera className="size-4" /> {shots.length ? "Add page" : "Take photo"}
        </Button>
        {shots.length > 0 && (
          <Button variant="button_primary" size="sm" onClick={submit} disabled={upload.isPending}>
            {upload.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileUp className="size-4" />
            )}
            {upload.isPending ? "Uploading…" : `Create PDF (${shots.length})`}
          </Button>
        )}
      </div>
    </div>
  );
}
