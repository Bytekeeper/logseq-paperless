import { describe, it, expect } from 'vitest'
import { escapeMarkdownLinkText, buildMarkdownLink } from '../src/lib/markdown'

describe('escapeMarkdownLinkText', () => {
  it('escapes square brackets', () => {
    expect(escapeMarkdownLinkText('Invoices [2026]')).toBe('Invoices \\[2026\\]')
  })

  it('leaves plain text untouched', () => {
    expect(escapeMarkdownLinkText('Invoices')).toBe('Invoices')
  })
})

describe('buildMarkdownLink', () => {
  it('builds a markdown link from a label and url', () => {
    expect(buildMarkdownLink('Invoices', 'https://paperless.example.com/view/1')).toBe(
      '[Invoices](https://paperless.example.com/view/1)'
    )
  })

  it('escapes brackets in the label but not the url', () => {
    expect(buildMarkdownLink('Q1 [Draft]', 'https://paperless.example.com/view/1')).toBe(
      '[Q1 \\[Draft\\]](https://paperless.example.com/view/1)'
    )
  })
})
