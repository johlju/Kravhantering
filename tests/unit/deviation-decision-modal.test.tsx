import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DeviationDecisionModal from '@/components/DeviationDecisionModal'

const confirmDiscardChanges = vi.hoisted(() => vi.fn())

const translations: Record<string, Record<string, string>> = {
  common: {
    cancel: 'Cancel',
    help: 'Help',
    saving: 'Saving',
  },
  deviation: {
    approve: 'Approve',
    decisionMotivation: 'Decision motivation',
    decisionMotivationHelp: 'Explain the review decision.',
    decisionMotivationPlaceholder: 'Explain the decision',
    recordDecision: 'Record decision',
    reject: 'Reject',
  },
}

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) =>
    translations[namespace]?.[key] ?? key,
}))
vi.mock('@/hooks/useDiscardChangesConfirmation', () => ({
  useDiscardChangesConfirmation: () => confirmDiscardChanges,
}))

describe('DeviationDecisionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    confirmDiscardChanges.mockResolvedValue(true)
  })

  it('does not render the dialog while closed', () => {
    render(
      <DeviationDecisionModal
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        open={false}
      />,
    )

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('records a trimmed rejection motivation', async () => {
    const onSubmit = vi.fn()
    render(
      <DeviationDecisionModal onClose={vi.fn()} onSubmit={onSubmit} open />,
    )

    const dialog = screen.getByRole('dialog', { name: 'Record decision' })
    const submit = within(dialog).getByRole('button', {
      name: 'Record decision',
    })
    expect(submit).toBeDisabled()

    const approve = within(dialog).getByRole('radio', { name: 'Approve' })
    const reject = within(dialog).getByRole('radio', { name: 'Reject' })
    await userEvent.click(reject)
    await userEvent.click(approve)
    await userEvent.click(reject)
    await userEvent.type(
      within(dialog).getByLabelText(/Decision motivation/, {
        selector: 'textarea',
      }),
      '  Does not meet the requirement  ',
    )
    await userEvent.click(submit)

    expect(onSubmit).toHaveBeenCalledWith(2, 'Does not meet the requirement')
  })

  it('closes an unchanged decision with Escape without a discard prompt', async () => {
    const onClose = vi.fn()
    render(<DeviationDecisionModal onClose={onClose} onSubmit={vi.fn()} open />)

    screen
      .getByLabelText(/Decision motivation/, { selector: 'textarea' })
      .focus()
    await userEvent.keyboard('{Escape}')

    expect(confirmDiscardChanges).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows a pending decision state and prevents cancellation', () => {
    render(
      <DeviationDecisionModal
        loading
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        open
      />,
    )

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Saving' })).toBeDisabled()
  })

  it('opens and closes the motivation help', async () => {
    render(<DeviationDecisionModal onClose={vi.fn()} onSubmit={vi.fn()} open />)

    const help = screen.getByRole('button', {
      name: 'Help: Decision motivation',
    })
    expect(help).toHaveAttribute('aria-expanded', 'false')

    await userEvent.click(help)
    expect(help).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Explain the review decision.')).toBeVisible()

    await userEvent.click(help)
    expect(help).toHaveAttribute('aria-expanded', 'false')
  })

  it('asks before closing a dirty decision and closes after confirmation', async () => {
    confirmDiscardChanges
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
    const onClose = vi.fn()
    render(<DeviationDecisionModal onClose={onClose} onSubmit={vi.fn()} open />)

    await userEvent.type(
      screen.getByLabelText(/Decision motivation/, { selector: 'textarea' }),
      'Needs review',
    )
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    await userEvent.click(cancel)
    expect(onClose).not.toHaveBeenCalled()

    await userEvent.click(cancel)
    expect(onClose).toHaveBeenCalledOnce()
    expect(confirmDiscardChanges).toHaveBeenNthCalledWith(1, cancel)
  })
  it('submits approval conditions and an inclusive end date', async () => {
    const onSubmit = vi.fn()
    render(
      <DeviationDecisionModal onClose={vi.fn()} onSubmit={onSubmit} open />,
    )
    await userEvent.type(
      screen.getByLabelText(/Decision motivation/, { selector: 'textarea' }),
      'Accepted',
    )
    await userEvent.type(
      screen.getByLabelText('conditions', { selector: 'textarea' }),
      'Weekly access review',
    )
    await userEvent.click(screen.getByLabelText('limitedValidity'))
    const date = screen.getByLabelText('validThrough', { selector: 'input' })
    await userEvent.type(date, '2099-09-30')
    await userEvent.click(
      screen.getByRole('button', { name: 'Record decision' }),
    )
    expect(onSubmit).toHaveBeenCalledWith(1, 'Accepted', {
      conditions: 'Weekly access review',
      validThrough: '2099-09-30',
    })
  })
  it('submits unlimited approval with empty conditions normalized to null', async () => {
    const onSubmit = vi.fn()
    render(
      <DeviationDecisionModal onClose={vi.fn()} onSubmit={onSubmit} open />,
    )
    await userEvent.type(
      screen.getByLabelText(/Decision motivation/, { selector: 'textarea' }),
      '  Accepted  ',
    )
    await userEvent.type(
      screen.getByLabelText('conditions', { selector: 'textarea' }),
      '   ',
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Record decision' }),
    )
    expect(onSubmit).toHaveBeenCalledWith(1, 'Accepted', {
      conditions: null,
      validThrough: null,
    })
  })

  it('requires a future or current end date only while approval validity is limited', async () => {
    const onSubmit = vi.fn()
    render(
      <DeviationDecisionModal onClose={vi.fn()} onSubmit={onSubmit} open />,
    )
    await userEvent.type(
      screen.getByLabelText(/Decision motivation/, { selector: 'textarea' }),
      'Accepted',
    )
    const submit = screen.getByRole('button', { name: 'Record decision' })
    await userEvent.click(screen.getByLabelText('limitedValidity'))
    expect(submit).toBeDisabled()
    await userEvent.type(
      screen.getByLabelText('validThrough', { selector: 'input' }),
      '2020-01-01',
    )
    expect(submit).toBeDisabled()
    await userEvent.click(screen.getByLabelText('unlimitedValidity'))
    expect(submit).toBeEnabled()
    await userEvent.click(submit)
    expect(onSubmit).toHaveBeenCalledWith(1, 'Accepted', {
      conditions: null,
      validThrough: null,
    })
  })

  it('allows rejection without approval terms even after entering an expired end date', async () => {
    const onSubmit = vi.fn()
    render(
      <DeviationDecisionModal
        onClose={vi.fn()}
        onSubmit={onSubmit}
        open
        scopeNotice="Applies to agreements A and B"
      />,
    )
    expect(screen.getByText('Applies to agreements A and B')).toBeVisible()
    await userEvent.type(
      screen.getByLabelText(/Decision motivation/, { selector: 'textarea' }),
      'Rejected',
    )
    await userEvent.click(screen.getByLabelText('limitedValidity'))
    await userEvent.type(
      screen.getByLabelText('validThrough', { selector: 'input' }),
      '2020-01-01',
    )
    await userEvent.click(screen.getByRole('radio', { name: 'Reject' }))
    await userEvent.click(
      screen.getByRole('button', { name: 'Record decision' }),
    )
    expect(onSubmit).toHaveBeenCalledWith(2, 'Rejected')
  })
})
