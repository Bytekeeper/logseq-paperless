import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { registerInsertSavedViewCommand } from '../src/commands/insert-saved-view-link'
import { PaperlessApiError } from '../src/lib/errors'
import { mockLogseq } from './support/mock-logseq'
import { flush } from './support/dom-events'

vi.mock('../src/api/paperless-client', () => ({
  listSavedViews: vi.fn(),
  buildSavedViewUrl: (baseUrl: string, id: number) => `${baseUrl}/view/${id}`,
}))

import { listSavedViews } from '../src/api/paperless-client'

const COMMAND = 'Paperless: Insert Saved View Link'

describe('registerInsertSavedViewCommand', () => {
  let appEl: HTMLDivElement

  beforeEach(() => {
    appEl = document.createElement('div')
    appEl.id = 'app'
    document.body.appendChild(appEl)
  })

  afterEach(() => {
    appEl.remove()
    delete (globalThis as any).logseq
    vi.clearAllMocks()
  })

  it('shows a warning and never calls the API when not configured', async () => {
    const handlers = mockLogseq({ paperlessBaseUrl: '', apiToken: '' })
    registerInsertSavedViewCommand()

    await handlers[COMMAND]()

    expect(listSavedViews).not.toHaveBeenCalled()
    expect(logseq.UI.showMsg).toHaveBeenCalledWith(expect.any(String), 'warning')
  })

  it('shows a warning when paperless-ngx has no saved views', async () => {
    const handlers = mockLogseq({ paperlessBaseUrl: 'https://p.example.com', apiToken: 't' })
    vi.mocked(listSavedViews).mockResolvedValue([])
    registerInsertSavedViewCommand()

    await handlers[COMMAND]()

    expect(logseq.UI.showMsg).toHaveBeenCalledWith(expect.stringContaining('No saved views'), 'warning')
  })

  it('reports an API error and does not open the popup if listSavedViews throws', async () => {
    const handlers = mockLogseq({ paperlessBaseUrl: 'https://p.example.com', apiToken: 't' })
    vi.mocked(listSavedViews).mockRejectedValue(new PaperlessApiError('network'))
    registerInsertSavedViewCommand()

    await handlers[COMMAND]()

    expect(logseq.UI.showMsg).toHaveBeenCalledWith(expect.any(String), 'error')
    expect(logseq.showMainUI).not.toHaveBeenCalled()
  })

  it('opens a centered popup with a picker when saved views are found', async () => {
    const handlers = mockLogseq({ paperlessBaseUrl: 'https://p.example.com', apiToken: 't' })
    vi.mocked(listSavedViews).mockResolvedValue([{ id: 1, name: 'Invoices' }])
    registerInsertSavedViewCommand()

    await handlers[COMMAND]()

    expect(logseq.showMainUI).toHaveBeenCalledWith({ autoFocus: true })
    expect(appEl.querySelector('.paperless-overlay')).not.toBeNull()
    expect(appEl.querySelector('.paperless-picker')).not.toBeNull()
  })

  it('inserts a markdown link to the selected saved view and tears down the popup', async () => {
    const handlers = mockLogseq({ paperlessBaseUrl: 'https://p.example.com', apiToken: 't' })
    vi.mocked(listSavedViews).mockResolvedValue([{ id: 1, name: 'Invoices' }])
    registerInsertSavedViewCommand()

    await handlers[COMMAND]()
    await flush() // let the picker's initial (synchronous-filter) fetchItems render

    const item = appEl.querySelector<HTMLLIElement>('.paperless-picker-item')!
    item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    await flush()

    expect(logseq.Editor.insertAtEditingCursor).toHaveBeenCalledWith(
      '[Invoices](https://p.example.com/view/1)'
    )
    expect(logseq.hideMainUI).toHaveBeenCalledWith({ restoreEditingCursor: true })
    expect(appEl.querySelector('.paperless-picker')).toBeNull()
  })

  it('tears down the popup on cancel without inserting anything', async () => {
    const handlers = mockLogseq({ paperlessBaseUrl: 'https://p.example.com', apiToken: 't' })
    vi.mocked(listSavedViews).mockResolvedValue([{ id: 1, name: 'Invoices' }])
    registerInsertSavedViewCommand()

    await handlers[COMMAND]()
    await flush()

    const overlay = appEl.querySelector<HTMLDivElement>('.paperless-overlay')!
    overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))

    expect(logseq.Editor.insertAtEditingCursor).not.toHaveBeenCalled()
    expect(logseq.hideMainUI).toHaveBeenCalledWith({ restoreEditingCursor: true })
    expect(appEl.querySelector('.paperless-picker')).toBeNull()
  })
})
