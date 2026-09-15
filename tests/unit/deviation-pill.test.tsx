import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import DeviationPill from '@/components/DeviationPill'

vi.mock('next-intl', () => ({
  useFormatter: () => ({
    dateTime: (date: Date, opts?: Intl.DateTimeFormatOptions) =>
      date.toLocaleDateString('en', opts),
  }),
  useTranslations:
    (section?: string) => (key: string, params?: Record<string, unknown>) => {
      if (section === 'common' && key === 'anonymousUser') return 'Anonymous'
      if (params && 'count' in params) return `${key}(${params.count})`
      return key
    },
}))

const baseDeviation = {
  id: 1,
  motivation: 'Test motivation text',
  createdBy: 'Alice',
  createdAt: '2024-01-15T10:00:00Z',
  isReviewRequested: 0,
  decision: null,
  decisionMotivation: null,
  decidedBy: null,
  decidedAt: null,
}

describe('DeviationPill', () => {
  it('renders pending deviation with amber styling, status chip, and role="status"', () => {
    const { container } = render(
      <DeviationPill history={[]} latest={baseDeviation} />,
    )

    expect(screen.getByText('deviationRequested')).toBeInTheDocument()
    expect(screen.getByText('Test motivation text')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
    // Non-color cue (WCAG 1.4.1): pending state shows explicit status text
    expect(screen.getByText('statusPending')).toBeInTheDocument()

    const pill = container.querySelector('.border-amber-200')
    expect(pill).toBeTruthy()
    // WCAG 4.1.3 status messages
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('renders approved deviation with green styling and approval chip', () => {
    const approved = {
      ...baseDeviation,
      decision: 1,
      decisionMotivation: 'Approved reason',
      decidedBy: 'Bob',
      decidedAt: '2024-01-16T10:00:00Z',
    }

    const { container } = render(
      <DeviationPill history={[]} latest={approved} />,
    )

    // statusApproved appears twice: once in the header chip, once in the decision heading
    expect(screen.getAllByText('statusApproved')).toHaveLength(2)
    expect(screen.getByText('Approved reason')).toBeInTheDocument()

    const pill = container.querySelector('.border-green-200')
    expect(pill).toBeTruthy()
  })

  it('shows the localized anonymous label for the no-user sentinel', () => {
    const approved = {
      ...baseDeviation,
      createdBy: 'no-user',
      decision: 1,
      decisionMotivation: 'Approved reason',
      decidedBy: ' no-user ',
      decidedAt: '2024-01-16T10:00:00Z',
    }

    render(<DeviationPill history={[]} latest={approved} />)

    expect(screen.getAllByText('Anonymous')).toHaveLength(2)
    expect(screen.queryByText(/no-user/i)).not.toBeInTheDocument()
  })

  it('renders rejected deviation with red styling and rejection chip', () => {
    const rejected = {
      ...baseDeviation,
      decision: 2,
      decisionMotivation: 'Rejected reason',
      decidedBy: 'Charlie',
      decidedAt: '2024-01-16T10:00:00Z',
    }

    const { container } = render(
      <DeviationPill history={[]} latest={rejected} />,
    )

    expect(screen.getAllByText('statusRejected')).toHaveLength(2)
    expect(screen.getByText('Rejected reason')).toBeInTheDocument()

    const pill = container.querySelector('.border-red-200')
    expect(pill).toBeTruthy()
  })

  it('does not show history section when history is empty', () => {
    render(<DeviationPill history={[]} latest={baseDeviation} />)

    expect(screen.queryByText(/historyLabel/)).not.toBeInTheDocument()
  })

  it('shows history disclosure when history exists', async () => {
    const historyItem = {
      ...baseDeviation,
      id: 2,
      motivation: 'Old deviation',
      decision: 1,
      decisionMotivation: 'Previously approved',
      decidedBy: 'Dave',
      decidedAt: '2024-01-10T10:00:00Z',
    }

    render(<DeviationPill history={[historyItem]} latest={baseDeviation} />)

    const summary = screen.getByText('historyLabel(1)')
    expect(summary).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(summary)

    expect(screen.getByText('Old deviation')).toBeInTheDocument()
  })
})

describe('approval permission details', () => {
  it('shows conditions, end date and renewal alongside the recorded approval', () => {
    render(
      <DeviationPill
        history={[]}
        latest={{
          ...baseDeviation,
          decision: 1,
          applicability: 'expired',
          conditions: 'Weekly access review',
          validThrough: '2026-09-15',
          renewsDeviationId: 7,
        }}
      />,
    )
    expect(screen.getByText('applicability.expired')).toBeVisible()
    expect(screen.getByText('validThroughValue')).toBeVisible()
    expect(screen.getByText('conditions: Weekly access review')).toBeVisible()
    expect(screen.getByText('renewalOf')).toBeVisible()
    expect(screen.getAllByText('statusApproved')).toHaveLength(2)
  })

  it('shows unlimited validity for an applicable approval without an end date', () => {
    render(
      <DeviationPill
        history={[]}
        latest={{ ...baseDeviation, decision: 1, applicability: 'applicable' }}
      />,
    )
    expect(screen.getByText('unlimitedValidity')).toBeVisible()
    expect(screen.getByText('applicability.applicable')).toBeVisible()
  })

  it('renders cancellation as a recorded outcome even without actor or date metadata', () => {
    render(
      <DeviationPill
        history={[]}
        latest={{
          ...baseDeviation,
          decision: 3,
          createdBy: null,
          createdAt: '',
        }}
      />,
    )
    expect(screen.getAllByText('statusCancelled')).toHaveLength(2)
    expect(screen.getByRole('status')).toHaveAttribute(
      'data-developer-mode-value',
      'cancelled',
    )
  })
})
