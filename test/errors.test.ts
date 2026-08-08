import { describe, it, expect, vi, afterEach } from 'vitest'
import { PaperlessApiError, reportApiError } from '../src/lib/errors'

function mockLogseq() {
  ;(globalThis as any).logseq = {
    UI: { showMsg: vi.fn() },
  }
}

describe('reportApiError', () => {
  afterEach(() => {
    delete (globalThis as any).logseq
    vi.restoreAllMocks()
  })

  it.each([
    ['missing-config', 'warning'],
    ['network', 'error'],
    ['unauthorized', 'error'],
    ['http', 'error'],
    ['parse', 'error'],
  ] as const)('shows a %s toast with status "%s"', (kind, status) => {
    mockLogseq()
    reportApiError(new PaperlessApiError(kind, 500))

    expect(logseq.UI.showMsg).toHaveBeenCalledTimes(1)
    expect(logseq.UI.showMsg).toHaveBeenCalledWith(expect.any(String), status)
  })

  it('includes the HTTP status in the http-kind message', () => {
    mockLogseq()
    reportApiError(new PaperlessApiError('http', 503))

    expect(logseq.UI.showMsg).toHaveBeenCalledWith(expect.stringContaining('503'), 'error')
  })

  it('falls back to a generic error toast and logs to console for a non-PaperlessApiError', () => {
    mockLogseq()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new Error('something else broke')

    reportApiError(err)

    expect(logseq.UI.showMsg).toHaveBeenCalledTimes(1)
    expect(logseq.UI.showMsg).toHaveBeenCalledWith(expect.any(String), 'error')
    expect(consoleSpy).toHaveBeenCalledWith(expect.any(String), err)
  })
})
