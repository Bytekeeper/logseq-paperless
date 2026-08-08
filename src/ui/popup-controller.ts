import { Picker, type PickerOptions } from './picker'

// `setMainUIInlineStyle` styles the *outer* iframe Logseq embeds for this plugin's main UI —
// it has no effect on layout inside the iframe's own document. Centering therefore needs two
// parts: size that outer iframe to the full window here, and separately center content inside
// it with ordinary CSS (see `createOverlay`'s `.paperless-overlay` class in picker.css), which
// only has room to work once the outer iframe actually spans the viewport.
export function showPopup(): void {
  logseq.setMainUIInlineStyle({
    position: 'fixed',
    top: '0px',
    left: '0px',
    width: '100vw',
    height: '100vh',
    zIndex: 11,
  })
  logseq.showMainUI({ autoFocus: true })
}

export function hidePopup(opts: { restoreEditingCursor?: boolean } = {}): void {
  logseq.hideMainUI({ restoreEditingCursor: opts.restoreEditingCursor ?? true })
}

/**
 * A full-viewport backdrop that centers its content and dismisses on a click
 * outside that content (not just Escape / a close button).
 */
export function createOverlay(onDismiss: () => void): HTMLDivElement {
  const overlay = document.createElement('div')
  overlay.className = 'paperless-overlay'
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) onDismiss()
  })
  return overlay
}

let activePopup: { destroy: () => void } | null = null

/**
 * Opens a Picker inside a centered popup, owning the whole open/close lifecycle: mounting
 * into #app, tearing down on select/cancel/backdrop-click, and — since this is the one place
 * that tracks "the" active popup rather than each command tracking its own — guaranteeing
 * only one popup is ever open across the whole plugin. A second command invoked while
 * another's popup is still open correctly closes that first one, rather than each command's
 * independent state going stale.
 */
export function openPickerPopup<T>(options: PickerOptions<T> & { onClose?: () => void }): void {
  activePopup?.destroy()

  const appEl = document.getElementById('app')
  if (!appEl) return
  appEl.replaceChildren()

  const close = () => {
    picker.destroy()
    appEl.replaceChildren()
    hidePopup({ restoreEditingCursor: true })
    activePopup = null
    options.onClose?.()
  }

  const picker = new Picker<T>({
    ...options,
    onSelect: (item) => {
      close()
      void options.onSelect(item)
    },
    onCancel: () => {
      close()
      options.onCancel()
    },
  })

  const overlay = createOverlay(close)
  appEl.appendChild(overlay)
  activePopup = { destroy: close }

  showPopup()
  picker.mount(overlay)
}
