import { act, fireEvent, render, screen } from '@testing-library/react'
import type { RefCallback } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DeveloperModeProvider from '@/components/DeveloperModeProvider'

const clipboardWriteText = vi.fn()

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) =>
    ({ badge: 'Developer Mode', copied: 'Copied', copyFailed: 'Copy failed' })[
      key
    ] ?? key,
}))

vi.mock('@/i18n/routing', () => ({
  usePathname: () => '/kravkatalog',
}))

function createRectRef(
  left: number,
  top: number,
  width = 140,
  height = 36,
): RefCallback<HTMLElement> {
  return node => {
    if (!node) {
      return
    }

    Object.defineProperty(node, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        bottom: top + height,
        height,
        left,
        right: left + width,
        toJSON: () => null,
        top,
        width,
        x: left,
        y: top,
      }),
    })
  }
}

function Fixture({ showExtra = false }: { showExtra?: boolean }) {
  return (
    <div>
      <div
        data-developer-mode-name="requirements table"
        ref={createRectRef(40, 80)}
      />
      <input data-testid="editor" ref={createRectRef(40, 24, 220)} />
      {showExtra ? (
        <div
          data-developer-mode-context="requirements table"
          data-developer-mode-name="floating pill"
          data-developer-mode-value="new requirement"
          ref={createRectRef(260, 80)}
        />
      ) : null}
    </div>
  )
}

async function flushDeveloperMode() {
  await act(async () => {
    vi.runOnlyPendingTimers()
    await Promise.resolve()
  })
}

describe('DeveloperModeProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    clipboardWriteText.mockReset()
    clipboardWriteText.mockResolvedValue(undefined)
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 900,
    })
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 1280,
    })
    Object.defineProperty(document.documentElement, 'clientHeight', {
      configurable: true,
      value: 900,
    })
    Object.defineProperty(document.documentElement, 'clientWidth', {
      configurable: true,
      value: 1280,
    })
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: clipboardWriteText,
      },
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('toggles with Mod+Alt+Shift+H, including the macOS Option-modified key case, and ignores editable fields', async () => {
    render(
      <DeveloperModeProvider>
        <Fixture />
      </DeveloperModeProvider>,
    )

    await flushDeveloperMode()

    fireEvent.keyDown(screen.getByTestId('editor'), {
      altKey: true,
      code: 'KeyH',
      key: 'Ó',
      metaKey: true,
      shiftKey: true,
    })
    await flushDeveloperMode()

    expect(screen.queryByText('requirements table')).not.toBeInTheDocument()

    fireEvent.keyDown(document, {
      altKey: true,
      code: 'KeyH',
      key: 'Ó',
      metaKey: true,
      shiftKey: true,
    })
    await flushDeveloperMode()

    expect(screen.getByText('requirements table')).toBeInTheDocument()

    fireEvent.keyDown(document, {
      altKey: true,
      code: 'KeyH',
      key: 'Ó',
      metaKey: true,
      shiftKey: true,
    })
    await flushDeveloperMode()

    expect(screen.queryByText('requirements table')).not.toBeInTheDocument()
  })

  it('rescans on DOM updates and copies contextual references', async () => {
    const { rerender } = render(
      <DeveloperModeProvider>
        <Fixture />
      </DeveloperModeProvider>,
    )

    await flushDeveloperMode()

    fireEvent.keyDown(document, {
      altKey: true,
      ctrlKey: true,
      key: 'H',
      shiftKey: true,
    })
    await flushDeveloperMode()

    expect(screen.getByText('requirements table')).toBeInTheDocument()

    await act(async () => {
      rerender(
        <DeveloperModeProvider>
          <Fixture showExtra />
        </DeveloperModeProvider>,
      )
      await Promise.resolve()
    })
    await flushDeveloperMode()

    const extraChip = screen.getByText('floating pill: new requirement')

    await act(async () => {
      fireEvent.click(extraChip)
      vi.runOnlyPendingTimers()
      await Promise.resolve()
    })

    expect(clipboardWriteText).toHaveBeenCalledWith(
      'requirements table > floating pill: new requirement',
    )
    expect(
      screen.getByText(
        'Copied: requirements table > floating pill: new requirement',
      ),
    ).toBeInTheDocument()

    await flushDeveloperMode()
  })
})
