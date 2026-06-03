import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, UserCheck, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { authApi } from '@/api/auth'
import { Section } from '@/components/common/Section'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/providers/AuthProvider'

export function AdminPanel() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const registration = useQuery({
    queryKey: ['admin', 'registration'],
    queryFn: authApi.registrationStatus,
  })
  const users = useQuery({ queryKey: ['admin', 'users'], queryFn: authApi.listUsers })

  const toggleReg = useMutation({
    mutationFn: (enabled: boolean) => authApi.setRegistration(enabled),
    onSuccess: (data) => {
      qc.setQueryData(['admin', 'registration'], data)
      toast.success(`Registration ${data.enabled ? 'enabled' : 'disabled'}`)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })

  const setActive = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => authApi.setActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  })

  const enabled = registration.data?.enabled ?? false

  return (
    <Section
      title="Administration"
      description="Admin-only — control sign-ups and accounts"
    >
      <div className="flex flex-col gap-6">
        {/* Registration toggle */}
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Open registration</p>
            <p className="text-xs text-muted-foreground">
              When off, no new accounts can self-register. Turn it on to invite someone, then off again.
            </p>
          </div>
          <Button
            variant={enabled ? 'button_green' : 'button_red'}
            size="sm"
            disabled={toggleReg.isPending}
            onClick={() => toggleReg.mutate(!enabled)}
          >
            {enabled ? 'Enabled' : 'Disabled'}
          </Button>
        </div>

        {/* Users */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Users</p>
          <div className="overflow-hidden rounded-lg border">
            {users.data?.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0"
              >
                <div className="flex min-w-0 items-center gap-2">
                  {u.role === 'Admin' && <ShieldCheck className="size-4 shrink-0 text-primary" />}
                  <span className="truncate text-sm">{u.username}</span>
                  {!u.isActive && (
                    <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                      disabled
                    </span>
                  )}
                </div>
                {u.id === user?.id ? (
                  <span className="text-xs text-muted-foreground">you</span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={setActive.isPending}
                    onClick={() => setActive.mutate({ id: u.id, active: !u.isActive })}
                  >
                    {u.isActive ? (
                      <>
                        <UserX className="size-4" /> Disable
                      </>
                    ) : (
                      <>
                        <UserCheck className="size-4" /> Enable
                      </>
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  )
}
