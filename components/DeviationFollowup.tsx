'use client'

import { AlertTriangle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { devMarker } from '@/lib/developer-mode-markers'

export default function DeviationFollowup({
  closed = false,
}: {
  closed?: boolean
}) {
  const t = useTranslations('deviation')
  return (
    <span
      className="inline-flex items-center gap-1.5 text-sm text-amber-800 dark:text-amber-200"
      role="status"
      {...devMarker({
        name: 'deviation follow-up',
        value: 'permission ended and action required',
        priority: 350,
      })}
    >
      <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
      {t(closed ? 'closedFollowup' : 'endedFollowup')}
    </span>
  )
}
