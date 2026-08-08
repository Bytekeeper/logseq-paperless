import { ensureConfigured } from '../settings'
import { searchDocuments, buildDocumentUrl, fetchDocumentThumbnail } from '../api/paperless-client'
import { reportApiError } from '../lib/errors'
import { buildMarkdownLink } from '../lib/markdown'
import { debounce } from '../lib/debounce'
import { openPickerPopup } from '../ui/popup-controller'
import type { PaperlessDocument } from '../api/types'

function renderDocumentLabel(doc: PaperlessDocument): string {
  const correspondent = doc.correspondent ? `${doc.correspondent} — ` : ''
  const created = doc.created ? doc.created.slice(0, 10) : ''
  return `${correspondent}${doc.title}${created ? ` (${created})` : ''}`
}

export function registerInsertDocumentLinkCommand(): void {
  logseq.Editor.registerSlashCommand('Paperless: Insert Document Link', async () => {
    const settings = ensureConfigured()
    if (!settings) return

    // Scoped to this invocation and keyed by doc id, so a document that reappears across
    // refined searches (e.g. "in" -> "inv" -> back to "in") reuses its already-fetched
    // thumbnail instead of re-fetching it every time the result list re-renders. Revoked
    // all at once in onClose below, rather than per-row on every intermediate re-render.
    const thumbnailUrls = new Map<number, Promise<string>>()

    function getThumbnailUrl(id: number): Promise<string> {
      let url = thumbnailUrls.get(id)
      if (!url) {
        url = fetchDocumentThumbnail(id).then((blob) => URL.createObjectURL(blob))
        thumbnailUrls.set(id, url)
      }
      return url
    }

    function renderDocumentRow(doc: PaperlessDocument, li: HTMLLIElement): void {
      li.classList.add('paperless-picker-item--doc')

      const thumb = document.createElement('img')
      thumb.className = 'paperless-picker-thumb'
      thumb.alt = ''
      li.appendChild(thumb)

      const label = document.createElement('span')
      label.className = 'paperless-picker-label'
      label.textContent = renderDocumentLabel(doc)
      li.appendChild(label)

      getThumbnailUrl(doc.id)
        .then((url) => {
          thumb.src = url
        })
        .catch(() => {
          // One failed thumbnail shouldn't interrupt search — reportApiError already
          // covers hard failures (missing config, auth) surfaced by the search itself.
          li.classList.add('paperless-picker-item--thumb-failed')
        })
    }

    const debouncedSearch = debounce(async (query: string) => {
      if (!query.trim()) return []
      return searchDocuments(query)
    }, 300)

    openPickerPopup<PaperlessDocument>({
      placeholder: 'Search documents…',
      fetchItems: debouncedSearch,
      renderItem: renderDocumentRow,
      getItemKey: (d) => String(d.id),
      onSelect: async (d) => {
        await logseq.Editor.insertAtEditingCursor(
          buildMarkdownLink(d.title, buildDocumentUrl(settings.baseUrl, d.id))
        )
      },
      onCancel: () => {},
      onError: reportApiError,
      onClose: () => {
        for (const url of thumbnailUrls.values()) {
          url.then((u) => URL.revokeObjectURL(u)).catch(() => {})
        }
      },
    })
  })
}
