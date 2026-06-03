import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { RequireAuth } from '@/components/auth/RequireAuth'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
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
      {/* Public auth screens */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Everything else requires a valid session */}
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<LibraryPage />} />
          <Route path="/doc/:id" element={<DocumentPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/folders" element={<FoldersPage />} />
          <Route path="/ai" element={<OllamaPage />} />
          <Route path="/ollama" element={<Navigate to="/ai" replace />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  )
}
