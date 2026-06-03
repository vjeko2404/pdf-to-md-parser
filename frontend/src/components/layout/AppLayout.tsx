import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { useIsMobile } from '@/hooks/useIsMobile'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AppLayout() {
  const isMobile = useIsMobile()
  const [drawer, setDrawer] = useState(false)

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TopBar isMobile={isMobile} onMenu={() => setDrawer((o) => !o)} />
      <div className="flex flex-1 overflow-hidden">
        {!isMobile && <Sidebar />}
        {isMobile && drawer && (
          <>
            <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setDrawer(false)} />
            <div className="fixed bottom-0 left-0 top-14 z-50">
              <Sidebar onNavigate={() => setDrawer(false)} />
            </div>
          </>
        )}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
