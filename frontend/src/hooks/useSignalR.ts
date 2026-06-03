import { useEffect } from 'react'
import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { getToken } from '@/api/token'

type Handler = (...args: never[]) => void

/**
 * Subscribe to the backend SignalR hub. Handlers are registered once on mount;
 * keep their closures stable (e.g. wrap a queryClient call) — the connection is
 * not torn down on handler identity changes.
 */
export function useSignalR(handlers: Record<string, Handler>) {
  useEffect(() => {
    const conn = new HubConnectionBuilder()
      .withUrl('/hub/live', { accessTokenFactory: () => getToken() ?? '' })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()

    for (const [name, fn] of Object.entries(handlers)) conn.on(name, fn)
    conn.start().catch(() => {})

    return () => {
      conn.stop().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
