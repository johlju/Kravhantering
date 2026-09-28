'use client'

// PROTOTYPE — throwaway. Floating variant switcher for UI prototypes.
// Lives only on the prototype/ai-anropsmall-importdialog branch.

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect } from 'react'

export interface PrototypeAxis {
  labels: Record<string, string>
  param: string
  values: string[]
}

export function usePrototypeParam(axis: PrototypeAxis): string {
  const searchParams = useSearchParams()
  const value = searchParams.get(axis.param)
  return value && axis.values.includes(value) ? value : axis.values[0]
}

function setParam(param: string, value: string) {
  const url = new URL(window.location.href)
  url.searchParams.set(param, value)
  window.history.replaceState(null, '', url)
}

export default function PrototypeSwitcher({ axes }: { axes: PrototypeAxis[] }) {
  const searchParams = useSearchParams()
  const current = (axis: PrototypeAxis) => {
    const value = searchParams.get(axis.param)
    return value && axis.values.includes(value) ? value : axis.values[0]
  }
  const cycle = useCallback(
    (axis: PrototypeAxis, step: 1 | -1) => {
      const value = searchParams.get(axis.param)
      const index = Math.max(0, axis.values.indexOf(value ?? axis.values[0]))
      const next =
        axis.values[(index + step + axis.values.length) % axis.values.length]
      setParam(axis.param, next)
    },
    [searchParams],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target?.closest('input, textarea, select, [contenteditable="true"]')
      ) {
        return
      }
      if (event.key === 'ArrowLeft') cycle(axes[0], -1)
      if (event.key === 'ArrowRight') cycle(axes[0], 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [axes, cycle])

  if (process.env.NODE_ENV === 'production') return null

  return (
    <div className="fixed bottom-4 left-1/2 z-[10000] flex -translate-x-1/2 flex-col gap-1 rounded-2xl bg-fuchsia-700 px-3 py-2 text-xs font-medium text-white shadow-2xl ring-2 ring-white/60">
      {axes.map((axis, axisIndex) => (
        <div className="flex items-center gap-2" key={axis.param}>
          <span className="w-10 opacity-70">{axis.param}</span>
          <button
            aria-label={`Previous ${axis.param}`}
            className="rounded-full p-1 hover:bg-white/20"
            onClick={() => cycle(axis, -1)}
            type="button"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-72 text-center">
            {current(axis)} ({axis.labels[current(axis)]})
          </span>
          <button
            aria-label={`Next ${axis.param}`}
            className="rounded-full p-1 hover:bg-white/20"
            onClick={() => cycle(axis, 1)}
            type="button"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {axisIndex === 0 ? <span className="opacity-60">← →</span> : null}
        </div>
      ))}
    </div>
  )
}
