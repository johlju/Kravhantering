import { fireEvent, render, screen, within } from '@testing-library/react'
import { createTranslator, NextIntlClientProvider } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RequirementsImportSupportPanel from '@/components/RequirementsImportSupportPanel'
import type { RequirementImportDestinationKind } from '@/lib/ai/requirement-prompt'
import type { AiRequestFileDestination } from '@/lib/requirements/ai-request-files'
import svMessages from '@/messages/sv.json'

const t = createTranslator({
  locale: 'sv',
  messages: svMessages,
  namespace: 'requirementsImportAiRequest',
})

const LIBRARY: AiRequestFileDestination = { kind: 'requirements_library' }

function renderPanel({
  destination = LIBRARY,
  destinationKind = 'requirements_library',
}: {
  destination?: AiRequestFileDestination | null
  destinationKind?: RequirementImportDestinationKind
} = {}) {
  const handlers = {
    onDownloadError: vi.fn(),
    onDownloadImportInstruction: vi.fn(),
    onDownloadSchema: vi.fn(),
  }
  render(
    <NextIntlClientProvider locale="sv" messages={svMessages}>
      <RequirementsImportSupportPanel
        destination={destination}
        destinationKind={destinationKind}
        headingId="support-heading"
        locale="sv"
        {...handlers}
      />
    </NextIntlClientProvider>,
  )
  return handlers
}

function ownPromptToggle() {
  return screen.getByRole('button', { name: t('ownPromptToggle') })
}

describe('RequirementsImportSupportPanel', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the three-step guide with the AI request file buttons in step 1', () => {
    renderPanel()

    expect(
      screen.getByRole('heading', { level: 3, name: t('guideTitle') }),
    ).toHaveAttribute('id', 'support-heading')
    const guide = screen.getByRole('list')
    expect(guide).toHaveAttribute('data-developer-mode-name', 'step guide')
    const steps = within(guide).getAllByRole('listitem')
    expect(steps.map(step => step.dataset.developerModeValue)).toEqual([
      'get files',
      'ask ai assistant',
      'add response',
    ])
    expect(steps[0]).toHaveTextContent(t('step1Title'))
    expect(
      within(steps[0]).getByRole('button', { name: t('downloadTemplate') }),
    ).toBeEnabled()
    expect(
      within(steps[0]).getByRole('button', {
        name: t('downloadReferenceData'),
      }),
    ).toBeEnabled()
    expect(steps[1]).toHaveTextContent(t('step2Title'))
    expect(steps[1]).toHaveTextContent(t('step2Body'))
    expect(steps[2]).toHaveTextContent(t('step3Title'))
    expect(steps[2]).toHaveTextContent(t('step3Body'))
    expect(
      screen.getByText(t('referenceDataFreshnessLibrary')),
    ).toBeInTheDocument()
  })

  it('names the specification references in the freshness note for a specification', () => {
    renderPanel({
      destination: {
        kind: 'requirements_specification',
        specificationId: 7,
      },
      destinationKind: 'requirements_specification',
    })

    expect(
      screen.getByText(t('referenceDataFreshnessSpecification')),
    ).toBeInTheDocument()
  })

  it('keeps "Own prompt or validation" collapsed until it is toggled', () => {
    const handlers = renderPanel()
    const toggle = ownPromptToggle()
    const region = document.getElementById(
      toggle.getAttribute('aria-controls') ?? '',
    )

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(toggle.parentElement).toHaveAttribute(
      'data-developer-mode-value',
      'own prompt or validation',
    )
    expect(region).toBeInTheDocument()
    expect(region).toBeEmptyDOMElement()
    expect(
      screen.queryByRole('button', { name: t('downloadSchema') }),
    ).not.toBeInTheDocument()

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const schema = screen.getByRole('button', { name: t('downloadSchema') })
    const instruction = screen.getByRole('button', {
      name: t('downloadImportInstruction'),
    })
    expect(region).toContainElement(schema)
    expect(schema).toHaveAccessibleDescription(t('ownPromptHelp'))
    expect(instruction).toBeEnabled()
    expect(instruction).not.toHaveAttribute('title')
    fireEvent.click(schema)
    fireEvent.click(instruction)
    expect(handlers.onDownloadSchema).toHaveBeenCalledTimes(1)
    expect(handlers.onDownloadImportInstruction).toHaveBeenCalledTimes(1)

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(region).toBeEmptyDOMElement()
  })

  it('disables the destination downloads with a reason when the specification is missing', () => {
    renderPanel({
      destination: null,
      destinationKind: 'requirements_specification',
    })

    for (const name of [t('downloadTemplate'), t('downloadReferenceData')]) {
      expect(screen.getByRole('button', { name })).toBeDisabled()
    }
    fireEvent.click(ownPromptToggle())
    expect(
      screen.getByRole('button', { name: t('downloadSchema') }),
    ).toBeEnabled()
    const instruction = screen.getByRole('button', {
      name: t('downloadImportInstruction'),
    })
    expect(instruction).toBeDisabled()
    expect(instruction).toHaveAttribute('title', t('filesUnavailable'))
  })
})
