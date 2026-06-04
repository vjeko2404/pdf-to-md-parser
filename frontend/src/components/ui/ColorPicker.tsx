import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Popover as BasePopover } from '@base-ui/react/popover'
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip'
import { useTranslation } from 'react-i18next'
import { Popover, PopoverTrigger, popoverSurface } from '@/components/ui/Popover'
import { cn } from '@/lib/utils'

/* ── HSV ↔ hex helpers (no deps) ─────────────────────────────────────────── */
const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n))

type Hsv = { h: number; s: number; v: number }

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g] = [c, x]
  else if (h < 120) [r, g] = [x, c]
  else if (h < 180) [g, b] = [c, x]
  else if (h < 240) [g, b] = [x, c]
  else if (h < 300) [r, b] = [x, c]
  else [r, b] = [c, x]
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}

function hsvToHex({ h, s, v }: Hsv): string {
  const [r, g, b] = hsvToRgb(h, s, v)
  return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')
}

function hexToHsv(hex: string): Hsv | null {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null
  const num = parseInt(h, 16)
  let r = ((num >> 16) & 255) / 255
  let g = ((num >> 8) & 255) / 255
  let b = (num & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let hue = 0
  if (d) {
    if (max === r) hue = ((g - b) / d) % 6
    else if (max === g) hue = (b - r) / d + 2
    else hue = (r - g) / d + 4
    hue *= 60
    if (hue < 0) hue += 360
  }
  return { h: hue, s: max === 0 ? 0 : d / max, v: max }
}

/** Curated palette — leads with the app's purple accent. */
const PRESETS = [
  '#aa3bff', '#7c3aed', '#3b82f6', '#06b6d4', '#10b981', '#22c55e',
  '#eab308', '#f59e0b', '#ef4444', '#ec4899', '#64748b', '#111827',
]

export interface ColorPickerProps {
  /** Current color as `#rrggbb`. */
  value: string
  onChange: (hex: string) => void
  className?: string
}

/**
 * Theme-aware color picker (replaces the OS-native `<input type="color">`, which
 * ignores dark/light mode). A rounded swatch button opens a {@link Popover} panel —
 * saturation/value square + hue slider + hex field + preset swatches — all rendered
 * on the shared {@link popoverSurface} so it follows the active theme.
 */
export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  const { t } = useTranslation('common')
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value) ?? { h: 270, s: 0.6, v: 0.9 })
  const [hexText, setHexText] = useState(value)
  const svRef = useRef<HTMLDivElement>(null)
  const hueRef = useRef<HTMLDivElement>(null)

  // Re-sync from an externally changed value (without clobbering live dragging).
  useEffect(() => {
    if (value.toLowerCase() === hsvToHex(hsv).toLowerCase()) return
    const next = hexToHsv(value)
    if (next) {
      setHsv(next)
      setHexText(value)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const commit = (next: Hsv) => {
    setHsv(next)
    const hex = hsvToHex(next)
    setHexText(hex)
    onChange(hex)
  }

  const handleSv = (e: ReactPointerEvent) => {
    const el = svRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    commit({
      ...hsv,
      s: clamp((e.clientX - r.left) / r.width),
      v: 1 - clamp((e.clientY - r.top) / r.height),
    })
  }

  const handleHue = (e: ReactPointerEvent) => {
    const el = hueRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    commit({ ...hsv, h: clamp((e.clientX - r.left) / r.width) * 360 })
  }

  const onHexInput = (text: string) => {
    setHexText(text)
    const next = hexToHsv(text)
    if (next) {
      setHsv(next)
      onChange(hsvToHex(next))
    }
  }

  const hueColor = hsvToHex({ h: hsv.h, s: 1, v: 1 })

  return (
    <Popover>
      {/* Base UI's tooltip primitive (distinct context) wraps the color popover's
          trigger, so the click-to-open binding still reaches the color Popover. */}
      <BaseTooltip.Provider delay={1000} closeDelay={0}>
        <BaseTooltip.Root>
          <BaseTooltip.Trigger
            render={
              <PopoverTrigger
                render={
                  <button
                    type="button"
                    aria-label={t('common:pickColor')}
                    style={{ backgroundColor: value }}
                    className={cn(
                      'size-9 shrink-0 cursor-pointer rounded-lg border shadow-sm outline-none transition-transform',
                      'hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring',
                      className,
                    )}
                  />
                }
              />
            }
          />
          <BaseTooltip.Portal>
            <BaseTooltip.Positioner side="top" sideOffset={6} className="z-50">
              <BaseTooltip.Popup
                className={cn(
                  popoverSurface,
                  'pointer-events-none px-2.5 py-1.5 text-xs leading-relaxed',
                )}
              >
                {t('common:pickColor')}
              </BaseTooltip.Popup>
            </BaseTooltip.Positioner>
          </BaseTooltip.Portal>
        </BaseTooltip.Root>
      </BaseTooltip.Provider>

      <BasePopover.Portal>
        <BasePopover.Positioner side="bottom" align="start" sideOffset={8} className="z-50">
          <BasePopover.Popup className={cn(popoverSurface, 'w-56 p-3')}>
            <div className="flex flex-col gap-3">
              {/* Saturation / value square */}
              <div
                ref={svRef}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId)
                  handleSv(e)
                }}
                onPointerMove={(e) => e.buttons & 1 && handleSv(e)}
                className="relative h-32 w-full cursor-crosshair rounded-md"
                style={{
                  backgroundColor: hueColor,
                  backgroundImage:
                    'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)',
                }}
              >
                <span
                  className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                  style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
                />
              </div>

              {/* Hue slider */}
              <div
                ref={hueRef}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId)
                  handleHue(e)
                }}
                onPointerMove={(e) => e.buttons & 1 && handleHue(e)}
                className="relative h-3 w-full cursor-pointer rounded-full"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)',
                }}
              >
                <span
                  className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                  style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: hueColor }}
                />
              </div>

              {/* Hex field + live preview */}
              <div className="flex items-center gap-2">
                <span
                  className="size-7 shrink-0 rounded-md border"
                  style={{ backgroundColor: value }}
                />
                <input
                  value={hexText}
                  onChange={(e) => onHexInput(e.target.value)}
                  spellCheck={false}
                  className="h-8 w-full rounded-md border bg-background px-2 font-mono text-xs outline-none transition-colors hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              {/* Presets */}
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => {
                      const next = hexToHsv(c)
                      if (next) commit(next)
                    }}
                    style={{ backgroundColor: c }}
                    className={cn(
                      'size-5 cursor-pointer rounded-full border transition-transform hover:scale-110',
                      value.toLowerCase() === c.toLowerCase() && 'ring-2 ring-ring ring-offset-1 ring-offset-popover',
                    )}
                  />
                ))}
              </div>
            </div>
          </BasePopover.Popup>
        </BasePopover.Positioner>
      </BasePopover.Portal>
    </Popover>
  )
}
