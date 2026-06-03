import { Toaster } from 'sonner'
import { useTheme } from '@/providers/ThemeProvider'

/** Sonner toaster wired to our theme (class-based dark mode), bottom-right, rounded. */
export function AppToaster() {
  const { theme } = useTheme()
  return (
    <Toaster
      position="bottom-right"
      theme={theme}
      richColors
      closeButton
      gap={10}
      offset={16}
      toastOptions={{
        style: { borderRadius: '0.75rem' },
        classNames: { toast: 'border shadow-lg backdrop-blur-sm', title: 'font-medium' },
      }}
    />
  )
}
