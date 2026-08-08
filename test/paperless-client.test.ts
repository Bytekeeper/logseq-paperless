import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  listSavedViews,
  searchDocuments,
  buildSavedViewUrl,
  buildDocumentUrl,
  fetchDocumentThumbnail,
} from '../src/api/paperless-client'
import { PaperlessApiError } from '../src/lib/errors'

const BASE_URL = 'https://paperless.example.com'
const TOKEN = 'test-token'

function mockLogseq() {
  ;(globalThis as any).logseq = {
    settings: { paperlessBaseUrl: BASE_URL, apiToken: TOKEN },
    UI: { showMsg: vi.fn() },
  }
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

function blobResponse(blob: Blob, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    blob: async () => blob,
  } as Response
}

describe('paperless-client', () => {
  beforeEach(() => {
    mockLogseq()
  })

  afterEach(() => {
    delete (globalThis as any).logseq
    vi.unstubAllGlobals()
  })

  it('listSavedViews sends the Authorization header and hits the saved views endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ count: 1, next: null, previous: null, results: [{ id: 1, name: 'Invoices' }] })
    )
    vi.stubGlobal('fetch', fetchMock)

    const views = await listSavedViews()

    expect(views).toEqual([{ id: 1, name: 'Invoices' }])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe(`${BASE_URL}/api/saved_views/`)
    expect(options.headers.Authorization).toBe(`Token ${TOKEN}`)
  })

  it('listSavedViews follows pagination and aggregates results', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          count: 2,
          next: `${BASE_URL}/api/saved_views/?page=2`,
          previous: null,
          results: [{ id: 1, name: 'Invoices' }],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({ count: 2, next: null, previous: null, results: [{ id: 2, name: 'Receipts' }] })
      )
    vi.stubGlobal('fetch', fetchMock)

    const views = await listSavedViews()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[1][0]).toBe(`${BASE_URL}/api/saved_views/?page=2`)
    expect(views).toEqual([
      { id: 1, name: 'Invoices' },
      { id: 2, name: 'Receipts' },
    ])
  })

  it('throws an unauthorized PaperlessApiError on a 401 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 401)))

    await expect(listSavedViews()).rejects.toMatchObject({
      kind: 'unauthorized',
    } satisfies Partial<PaperlessApiError>)
  })

  it('throws a network PaperlessApiError when fetch rejects (unreachable host or CORS block)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    )

    await expect(listSavedViews()).rejects.toMatchObject({
      kind: 'network',
    } satisfies Partial<PaperlessApiError>)
  })

  it('throws an http PaperlessApiError with the status on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)))

    await expect(listSavedViews()).rejects.toMatchObject({
      kind: 'http',
      status: 500,
    } satisfies Partial<PaperlessApiError>)
  })

  it('throws a missing-config PaperlessApiError when settings are absent', async () => {
    ;(globalThis as any).logseq.settings = { paperlessBaseUrl: '', apiToken: '' }
    vi.stubGlobal('fetch', vi.fn())

    await expect(listSavedViews()).rejects.toMatchObject({
      kind: 'missing-config',
    } satisfies Partial<PaperlessApiError>)
  })

  it('searchDocuments queries with the search term and a page size', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        count: 1,
        next: null,
        previous: null,
        results: [{ id: 5, title: 'Electric Bill', correspondent: 'Utility Co', created: '2026-01-01' }],
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const docs = await searchDocuments('electric bill')

    expect(docs).toEqual([{ id: 5, title: 'Electric Bill', correspondent: 'Utility Co', created: '2026-01-01' }])
    const url = new URL(fetchMock.mock.calls[0][0])
    expect(url.pathname).toBe('/api/documents/')
    expect(url.searchParams.get('query')).toBe('electric bill')
    expect(url.searchParams.get('page_size')).toBe('20')
  })

  it('fetchDocumentThumbnail hits the thumbnail endpoint and returns the blob', async () => {
    const blob = new Blob(['fake-png-bytes'], { type: 'image/png' })
    const fetchMock = vi.fn().mockResolvedValue(blobResponse(blob))
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchDocumentThumbnail(5)

    expect(result).toBe(blob)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe(`${BASE_URL}/api/documents/5/thumb/`)
    expect(options.headers.Authorization).toBe(`Token ${TOKEN}`)
  })

  it('fetchDocumentThumbnail throws unauthorized on a 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(blobResponse(new Blob(), 401)))

    await expect(fetchDocumentThumbnail(5)).rejects.toMatchObject({
      kind: 'unauthorized',
    } satisfies Partial<PaperlessApiError>)
  })
})

describe('URL builders', () => {
  it('buildSavedViewUrl points at /view/:id', () => {
    expect(buildSavedViewUrl(BASE_URL, 7)).toBe(`${BASE_URL}/view/7`)
  })

  it('buildDocumentUrl points at /documents/:id', () => {
    expect(buildDocumentUrl(BASE_URL, 42)).toBe(`${BASE_URL}/documents/42`)
  })
})
