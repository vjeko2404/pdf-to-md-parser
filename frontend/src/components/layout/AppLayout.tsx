import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useIsMobile } from '@/hooks/useIsMobile'
import { Animate } from '@/components/common/Animate'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function AppLayout() {
  const isMobile = useIsMobile()
  const location = useLocation()
  const [drawer, setDrawer] = useState(false)

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <TopBar isMobile={isMobile} onMenu={() => setDrawer((o) => !o)} />
      <div className="flex flex-1 overflow-hidden">
        {!isMobile && <Sidebar />}
        {isMobile && drawer && (
          <>
            <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setDrawer(false)} />
            <div className="fixed bottom-0 left-0 top-[calc(3.5rem+env(safe-area-inset-top))] z-50">
              <Sidebar onNavigate={() => setDrawer(false)} />
            </div>
          </>
        )}
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          {/* Key by pathname so every route change (incl. opening a document) replays
              the entrance animation. Search-param changes (filters) don't re-trigger. */}
          <Animate key={location.pathname} className="h-full">
            <Outlet />
          </Animate>
        </main>
      </div>
    </div>
  )
}
