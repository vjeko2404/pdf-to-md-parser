import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// Mirrors the backend policy in AuthService.ValidatePassword.
export const PASSWORD_RULES: { label: string; test: (pw: string) => boolean }[] = [
  { label: 'At least 8 characters', test: (pw) => pw.length >= 8 },
  { label: 'An uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { label: 'A number', test: (pw) => /[0-9]/.test(pw) },
  { label: 'A symbol', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
]

/** True when every policy rule passes. */
export function isStrong(pw: string): boolean {
  return PASSWORD_RULES.every((r) => r.test(pw))
}

export function PasswordStrength({ password }: { password: string }) {
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length
  const pct = (passed / PASSWORD_RULES.length) * 100
  const barColor =
    passed <= 1 ? 'bg-red-500' : passed <= 2 ? 'bg-amber-500' : passed < 4 ? 'bg-yellow-400' : 'bg-green-500'

  return (
    <div className="flex flex-col gap-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full transition-all duration-300', barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1">
        {PASSWORD_RULES.map((r) => {
          const ok = r.test(password)
          return (
            <li
              key={r.label}
              className={cn(
                'flex items-center gap-1.5 text-xs',
                ok ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
              )}
            >
              {ok ? <Check className="size-3.5" /> : <X className="size-3.5 opacity-50" />}
              {r.label}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
