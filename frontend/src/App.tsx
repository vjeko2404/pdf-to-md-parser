import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { LibraryPage } from '@/pages/LibraryPage'
import { DocumentPage } from '@/pages/DocumentPage'
import { CategoriesPage } from '@/pages/CategoriesPage'
import { FoldersPage } from '@/pages/FoldersPage'
import { OllamaPage } from '@/pages/OllamaPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { LogsPage } from '@/pages/LogsPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/doc/:id" element={<DocumentPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/folders" element={<FoldersPage />} />
        <Route path="/ollama" element={<OllamaPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/logs" element={<LogsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
