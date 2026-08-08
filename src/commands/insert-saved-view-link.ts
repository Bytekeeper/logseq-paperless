import { ensureConfigured } from '../settings'
import { listSavedViews, buildSavedViewUrl } from '../api/paperless-client'
import { reportApiError } from '../lib/errors'
import { buildMarkdownLink } from '../lib/markdown'
import { openPickerPopup } from '../ui/popup-controller'
import type { SavedView } from '../api/types'

export function registerInsertSavedViewCommand(): void {
  logseq.Editor.registerSlashCommand('Paperless: Insert Saved View Link', async () => {
    const settings = ensureConfigured()
    if (!settings) return

    let views: SavedView[]
    try {
      views = await listSavedViews()
    } catch (err) {
      reportApiError(err)
      return
    }

    if (views.length === 0) {
      logseq.UI.showMsg('No saved views found in paperless-ngx.', 'warning')
      return
    }

    openPickerPopup<SavedView>({
      placeholder: 'Filter saved views…',
      fetchItems: async (query) =>
        views.filter((v) => v.name.toLowerCase().includes(query.toLowerCase())),
      renderItem: (v, li) => {
        li.textContent = v.name
      },
      getItemKey: (v) => String(v.id),
      onSelect: async (v) => {
        await logseq.Editor.insertAtEditingCursor(
          buildMarkdownLink(v.name, buildSavedViewUrl(settings.baseUrl, v.id))
        )
      },
      onCancel: () => {},
      onError: reportApiError,
    })
  })
}
