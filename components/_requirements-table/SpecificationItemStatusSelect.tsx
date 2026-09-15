'use client'

import { memo, useCallback, useMemo } from 'react'
import type { SpecificationItemStatusOption } from '@/lib/requirements/list-view'

interface SpecificationItemStatusSelectProps {
  ariaLabel: string
  hasApprovedDeviation: boolean
  itemRef: string
  locale: string
  onChange: (itemRef: string, statusId: number) => void
  statuses: SpecificationItemStatusOption[]
  statusId: number | undefined
  tooltip?: string
}

interface StatusOption {
  description: string | undefined
  disabled: boolean
  id: number
  label: string
}

function SpecificationItemStatusSelectImpl({
  ariaLabel,
  hasApprovedDeviation,
  itemRef,
  locale,
  onChange,
  statusId,
  statuses,
  tooltip,
}: SpecificationItemStatusSelectProps) {
  const options = useMemo<StatusOption[]>(
    () =>
      statuses
        .filter(
          status =>
            !status.isDeviationStatus ||
            hasApprovedDeviation ||
            status.id === statusId,
        )
        .map(status => ({
          disabled: Boolean(status.isDeviationStatus) && !hasApprovedDeviation,
          description:
            (locale === 'sv' ? status.descriptionSv : status.descriptionEn) ||
            undefined,
          id: status.id,
          label: locale === 'sv' ? status.nameSv : status.nameEn,
        })),
    [hasApprovedDeviation, locale, statuses, statusId],
  )

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value
      if (value === '') {
        return
      }
      onChange(itemRef, Number(value))
    },
    [itemRef, onChange],
  )

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLSelectElement>) => {
      event.stopPropagation()
    },
    [],
  )

  return (
    <select
      aria-label={ariaLabel}
      className="w-auto max-w-full rounded-lg border border-gray-300 dark:border-secondary-600 bg-white dark:bg-secondary-800/50 py-1 px-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400/50 dark:focus:ring-primary-400/50 transition-all duration-200"
      onChange={handleChange}
      onClick={handleClick}
      title={tooltip}
      value={statusId ?? ''}
    >
      {options.map(option => (
        <option
          disabled={option.disabled}
          key={option.id}
          title={option.description}
          value={option.id}
        >
          {option.label}
        </option>
      ))}
    </select>
  )
}

const SpecificationItemStatusSelect = memo(SpecificationItemStatusSelectImpl)
SpecificationItemStatusSelect.displayName = 'SpecificationItemStatusSelect'

export default SpecificationItemStatusSelect
