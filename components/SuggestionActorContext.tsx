'use client'

import { useLocale, useTranslations } from 'next-intl'
import { devMarker } from '@/lib/developer-mode-markers'
import { formatActorDisplayNameForLocale } from '@/lib/privacy/display-name'

interface SuggestionActorContextProps {
  currentActorName?: string | null
  helpText: string
  label: string
  recordedName?: string | null
}

export default function SuggestionActorContext({
  currentActorName = null,
  helpText,
  label,
  recordedName,
}: SuggestionActorContextProps) {
  const locale = useLocale()
  const tf = useTranslations('improvementSuggestion')
  const name = recordedName === undefined ? currentActorName : recordedName

  return (
    <div
      {...devMarker({ name: 'section', value: 'suggestion-recorded-actor' })}
    >
      <p className="text-sm font-medium text-secondary-900 dark:text-secondary-100">
        {label}
      </p>
      <p aria-label={label} className="text-sm" role="status">
        {name === null && recordedName === undefined
          ? tf('actorUnavailable')
          : formatActorDisplayNameForLocale(name, locale) || '—'}
      </p>
      <p className="mt-1 text-xs text-secondary-600 dark:text-secondary-400">
        {helpText}
      </p>
    </div>
  )
}
