import { describe, it, expect, vi, afterEach } from 'vitest'
import { createOverlay, showPopup, hidePopup } from '../src/ui/popup-controller'

function mockLogseq() {
  ;(globalThis as any).logseq = {
    setMainUIInlineStyle: vi.fn(),
    showMainUI: vi.fn(),
    hideMainUI: vi.fn(),
  }
}

describe('showPopup', () => {
  afterEach(() => {
    delete (globalThis as any).logseq
  })

  it('sizes the outer iframe to the full viewport before showing it', () => {
    mockLogseq()
    showPopup()

    expect(logseq.setMainUIInlineStyle).toHaveBeenCalledWith(
      expect.objectContaining({ position: 'fixed', width: '100vw', height: '100vh' })
    )
    expect(logseq.showMainUI).toHaveBeenCalledWith({ autoFocus: true })
  })
})

describe('hidePopup', () => {
  afterEach(() => {
    delete (globalThis as any).logseq
  })

  it('restores the editing cursor by default', () => {
    mockLogseq()
    hidePopup()

    expect(logseq.hideMainUI).toHaveBeenCalledWith({ restoreEditingCursor: true })
  })

  it('respects an explicit restoreEditingCursor: false', () => {
    mockLogseq()
    hidePopup({ restoreEditingCursor: false })

    expect(logseq.hideMainUI).toHaveBeenCalledWith({ restoreEditingCursor: false })
  })
})

describe('createOverlay', () => {
  let container: HTMLDivElement

  afterEach(() => {
    container?.remove()
  })

  function setup() {
    container = document.createElement('div')
    document.body.appendChild(container)
    const onDismiss = vi.fn()
    const overlay = createOverlay(onDismiss)
    container.appendChild(overlay)
    return { overlay, onDismiss }
  }

  it('dismisses when the backdrop itself is clicked', () => {
    const { overlay, onDismiss } = setup()

    overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('does not dismiss when a child of the overlay is clicked', () => {
    const { overlay, onDismiss } = setup()
    const child = document.createElement('div')
    overlay.appendChild(child)

    child.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))

    expect(onDismiss).not.toHaveBeenCalled()
  })
})
