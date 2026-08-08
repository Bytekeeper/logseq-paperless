import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { registerInsertDocumentLinkCommand } from '../src/commands/insert-document-link'
import { mockLogseq } from './support/mock-logseq'
import { fireInput } from './support/dom-events'

vi.mock('../src/api/paperless-client', () => ({
  searchDocuments: vi.fn(),
  buildDocumentUrl: (baseUrl: string, id: number) => `${baseUrl}/documents/${id}`,
  fetchDocumentThumbnail: vi.fn(),
}))

import { searchDocuments, fetchDocumentThumbnail } from '../src/api/paperless-client'

const COMMAND = 'Paperless: Insert Document Link'
const DEBOUNCE_MS = 300

describe('registerInsertDocumentLinkCommand', () => {
  let appEl: HTMLDivElement

  beforeEach(() => {
    vi.useFakeTimers()
    appEl = document.createElement('div')
    appEl.id = 'app'
    document.body.appendChild(appEl)
    URL.createObjectURL = vi.fn((blob: Blob) => `blob:mock-${(blob as any).__id ?? 'x'}`)
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    // popup-controller.ts tracks "the" active popup as module state, shared across tests
    // in this file — dismiss whatever a test left open so it can't leak into the next one.
    appEl.querySelector<HTMLDivElement>('.paperless-overlay')
      ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    appEl.remove()
    delete (globalThis as any).logseq
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('shows a warning and never searches when not configured', async () => {
    const handlers = mockLogseq({ paperlessBaseUrl: '', apiToken: '' })
    registerInsertDocumentLinkCommand()

    await handlers[COMMAND]()

    expect(searchDocuments).not.toHaveBeenCalled()
    expect(logseq.UI.showMsg).toHaveBeenCalledWith(expect.any(String), 'warning')
  })

  it('opens the popup without searching for a blank initial query', async () => {
    const handlers = mockLogseq({ paperlessBaseUrl: 'https://p.example.com', apiToken: 't' })
    registerInsertDocumentLinkCommand()

    await handlers[COMMAND]()
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    expect(logseq.showMainUI).toHaveBeenCalledWith({ autoFocus: true })
    expect(searchDocuments).not.toHaveBeenCalled()
    expect(appEl.querySelectorAll('.paperless-picker-item')).toHaveLength(0)
  })

  it('searches after the debounce window and renders a thumbnail per result', async () => {
    const handlers = mockLogseq({ paperlessBaseUrl: 'https://p.example.com', apiToken: 't' })
    vi.mocked(searchDocuments).mockResolvedValue([
      { id: 5, title: 'Electric Bill', correspondent: 'Utility Co', created: '2026-01-15' },
    ])
    vi.mocked(fetchDocumentThumbnail).mockResolvedValue(new Blob())
    registerInsertDocumentLinkCommand()

    await handlers[COMMAND]()
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    const input = appEl.querySelector<HTMLInputElement>('.paperless-picker-input')!
    fireInput(input, 'electric')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    expect(searchDocuments).toHaveBeenCalledWith('electric')
    const row = appEl.querySelector<HTMLLIElement>('.paperless-picker-item')!
    expect(row.textContent).toContain('Electric Bill')
    expect(fetchDocumentThumbnail).toHaveBeenCalledWith(5)

    const img = row.querySelector<HTMLImageElement>('img.paperless-picker-thumb')!
    expect(img.src).toMatch(/^blob:/)
  })

  it('marks the row as thumb-failed without breaking the list if the thumbnail fetch rejects', async () => {
    const handlers = mockLogseq({ paperlessBaseUrl: 'https://p.example.com', apiToken: 't' })
    vi.mocked(searchDocuments).mockResolvedValue([
      { id: 5, title: 'Electric Bill', correspondent: null, created: '2026-01-15' },
    ])
    vi.mocked(fetchDocumentThumbnail).mockRejectedValue(new Error('404'))
    registerInsertDocumentLinkCommand()

    await handlers[COMMAND]()
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    const input = appEl.querySelector<HTMLInputElement>('.paperless-picker-input')!
    fireInput(input, 'electric')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    const row = appEl.querySelector<HTMLLIElement>('.paperless-picker-item')!
    expect(row.classList.contains('paperless-picker-item--thumb-failed')).toBe(true)
  })

  it('does not re-fetch a thumbnail for a document that reappears across searches', async () => {
    const handlers = mockLogseq({ paperlessBaseUrl: 'https://p.example.com', apiToken: 't' })
    const doc = { id: 5, title: 'Electric Bill', correspondent: null, created: '2026-01-15' }
    vi.mocked(searchDocuments)
      .mockResolvedValueOnce([doc])
      .mockResolvedValueOnce([{ id: 9, title: 'Water Bill', correspondent: null, created: '2026-01-20' }])
      .mockResolvedValueOnce([doc])
    vi.mocked(fetchDocumentThumbnail).mockResolvedValue(new Blob())
    registerInsertDocumentLinkCommand()

    await handlers[COMMAND]()
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    const input = appEl.querySelector<HTMLInputElement>('.paperless-picker-input')!

    fireInput(input, 'electric')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    fireInput(input, 'water')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    fireInput(input, 'electric')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    // doc 5 was rendered twice (in the 1st and 3rd result sets) but only fetched once
    expect(fetchDocumentThumbnail).toHaveBeenCalledTimes(2) // doc 5 once, doc 9 once
    expect(URL.revokeObjectURL).not.toHaveBeenCalled() // nothing revoked mid-session
  })

  it('revokes every cached thumbnail URL once the popup closes', async () => {
    const handlers = mockLogseq({ paperlessBaseUrl: 'https://p.example.com', apiToken: 't' })
    vi.mocked(searchDocuments).mockResolvedValue([
      { id: 5, title: 'Electric Bill', correspondent: null, created: '2026-01-15' },
    ])
    vi.mocked(fetchDocumentThumbnail).mockResolvedValue(new Blob())
    registerInsertDocumentLinkCommand()

    await handlers[COMMAND]()
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    const input = appEl.querySelector<HTMLInputElement>('.paperless-picker-input')!
    fireInput(input, 'electric')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    const overlay = appEl.querySelector<HTMLDivElement>('.paperless-overlay')!
    overlay.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    await vi.advanceTimersByTimeAsync(0)

    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
  })

  it('inserts a markdown link to the selected document and tears down the popup', async () => {
    const handlers = mockLogseq({ paperlessBaseUrl: 'https://p.example.com', apiToken: 't' })
    vi.mocked(searchDocuments).mockResolvedValue([
      { id: 5, title: 'Electric Bill', correspondent: null, created: '2026-01-15' },
    ])
    vi.mocked(fetchDocumentThumbnail).mockResolvedValue(new Blob())
    registerInsertDocumentLinkCommand()

    await handlers[COMMAND]()
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)
    const input = appEl.querySelector<HTMLInputElement>('.paperless-picker-input')!
    fireInput(input, 'electric')
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    const row = appEl.querySelector<HTMLLIElement>('.paperless-picker-item')!
    row.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    await vi.advanceTimersByTimeAsync(0)

    expect(logseq.Editor.insertAtEditingCursor).toHaveBeenCalledWith(
      '[Electric Bill](https://p.example.com/documents/5)'
    )
    expect(logseq.hideMainUI).toHaveBeenCalledWith({ restoreEditingCursor: true })
    expect(appEl.querySelector('.paperless-picker')).toBeNull()
  })
})
