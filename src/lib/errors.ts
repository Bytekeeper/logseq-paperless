export type PaperlessApiErrorKind = 'missing-config' | 'network' | 'unauthorized' | 'http' | 'parse'

export class PaperlessApiError extends Error {
  kind: PaperlessApiErrorKind
  status?: number

  // reportApiError below is the single source of truth for user-facing copy — it branches
  // only on `kind`/`status`, so throw sites don't author a separate descriptive message
  // that would just go unread.
  constructor(kind: PaperlessApiErrorKind, status?: number) {
    super(kind)
    this.name = 'PaperlessApiError'
    this.kind = kind
    this.status = status
  }
}

export function reportApiError(err: unknown): void {
  if (err instanceof PaperlessApiError) {
    switch (err.kind) {
      case 'missing-config':
        logseq.UI.showMsg(
          'Paperless-ngx base URL and API token must be set in this plugin\'s settings first.',
          'warning'
        )
        return
      case 'network':
        logseq.UI.showMsg(
          'Could not reach paperless-ngx. Check the base URL, that the server is running, and that it allows cross-origin requests from Logseq (PAPERLESS_CORS_ALLOWED_HOSTS) — see the README.',
          'error'
        )
        return
      case 'unauthorized':
        logseq.UI.showMsg('Paperless-ngx rejected the API token (401/403). Check the token in settings.', 'error')
        return
      case 'http':
        logseq.UI.showMsg(`Paperless-ngx returned an error (HTTP ${err.status ?? '??'}).`, 'error')
        return
      case 'parse':
        logseq.UI.showMsg('Paperless-ngx returned an unexpected response.', 'error')
        return
    }
  }
  console.error('Unexpected error in logseq-plugin-paperless', err)
  logseq.UI.showMsg('Unexpected error talking to paperless-ngx. See the console for details.', 'error')
}
