import { describe, it, expect, vi, afterEach } from 'vitest'
import { getPaperlessSettings, ensureConfigured } from '../src/settings'

function mockLogseq(settings: Record<string, unknown>) {
  ;(globalThis as any).logseq = {
    settings,
    UI: { showMsg: vi.fn() },
  }
}

describe('getPaperlessSettings', () => {
  afterEach(() => {
    delete (globalThis as any).logseq
  })

  it('returns null when base URL is missing', () => {
    mockLogseq({ paperlessBaseUrl: '', apiToken: 'abc' })
    expect(getPaperlessSettings()).toBeNull()
  })

  it('returns null when logseq.settings is undefined entirely', () => {
    ;(globalThis as any).logseq = { UI: { showMsg: vi.fn() } }
    expect(getPaperlessSettings()).toBeNull()
  })

  it('returns null when fields are present but not strings', () => {
    mockLogseq({ paperlessBaseUrl: 123, apiToken: null })
    expect(getPaperlessSettings()).toBeNull()
  })

  it('returns null when token is missing', () => {
    mockLogseq({ paperlessBaseUrl: 'https://paperless.example.com', apiToken: '' })
    expect(getPaperlessSettings()).toBeNull()
  })

  it('trims a trailing slash from the base URL', () => {
    mockLogseq({ paperlessBaseUrl: 'https://paperless.example.com/', apiToken: 'abc' })
    expect(getPaperlessSettings()).toEqual({ baseUrl: 'https://paperless.example.com', token: 'abc' })
  })

  it('trims whitespace from both fields', () => {
    mockLogseq({ paperlessBaseUrl: '  https://paperless.example.com  ', apiToken: '  abc  ' })
    expect(getPaperlessSettings()).toEqual({ baseUrl: 'https://paperless.example.com', token: 'abc' })
  })

  it('returns both fields when present and valid', () => {
    mockLogseq({ paperlessBaseUrl: 'https://paperless.example.com', apiToken: 'abc' })
    expect(getPaperlessSettings()).toEqual({ baseUrl: 'https://paperless.example.com', token: 'abc' })
  })
})

describe('ensureConfigured', () => {
  afterEach(() => {
    delete (globalThis as any).logseq
  })

  it('shows a warning toast and returns null when not configured', () => {
    mockLogseq({ paperlessBaseUrl: '', apiToken: '' })
    expect(ensureConfigured()).toBeNull()
    expect((globalThis as any).logseq.UI.showMsg).toHaveBeenCalledWith(expect.any(String), 'warning')
  })

  it('returns the settings without a toast when configured', () => {
    mockLogseq({ paperlessBaseUrl: 'https://paperless.example.com', apiToken: 'abc' })
    expect(ensureConfigured()).toEqual({ baseUrl: 'https://paperless.example.com', token: 'abc' })
    expect((globalThis as any).logseq.UI.showMsg).not.toHaveBeenCalled()
  })
})
