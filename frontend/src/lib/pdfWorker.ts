import { pdfjs } from 'react-pdf'

// Vite-friendly worker setup for react-pdf / pdf.js.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()
