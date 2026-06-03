/**
 * Downscale + re-encode a camera photo to a compact JPEG before upload. Phone cameras
 * shoot 5–8 MB; this caps the longest edge and re-encodes at a sane quality so a multi-page
 * scan stays small. Also normalizes formats (HEIC/PNG → JPEG) via the canvas pipeline.
 */
export async function compressImage(
  file: File | Blob,
  maxDim = 2000,
  quality = 0.7,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height))
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close?.()
    throw new Error('canvas 2D context unavailable')
  }
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close?.()

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('image encoding failed'))),
      'image/jpeg',
      quality,
    ),
  )
}
