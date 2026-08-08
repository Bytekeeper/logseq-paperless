import { getPaperlessSettings, type PaperlessSettings } from '../settings'
import { PaperlessApiError } from '../lib/errors'
import type { PaginatedResponse, PaperlessDocument, SavedView } from './types'

const MAX_PAGES = 10

function requireSettings(): PaperlessSettings {
  const settings = getPaperlessSettings()
  if (!settings) {
    throw new PaperlessApiError('missing-config')
  }
  return settings
}

async function fetchWithAuth(url: string, token: string, headers?: Record<string, string>): Promise<Response> {
  let res: Response
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Token ${token}`,
        ...headers,
      },
    })
  } catch (err) {
    throw new PaperlessApiError('network')
  }

  if (res.status === 401 || res.status === 403) {
    throw new PaperlessApiError('unauthorized', res.status)
  }
  if (!res.ok) {
    throw new PaperlessApiError('http', res.status)
  }
  return res
}

async function fetchJson<T>(url: string, token: string): Promise<T> {
  const res = await fetchWithAuth(url, token, { Accept: 'application/json' })
  try {
    return (await res.json()) as T
  } catch (err) {
    throw new PaperlessApiError('parse')
  }
}

async function fetchBlob(url: string, token: string): Promise<Blob> {
  const res = await fetchWithAuth(url, token)
  return res.blob()
}

async function request<T>(path: string, params?: Record<string, string>): Promise<T> {
  const settings = requireSettings()

  const url = new URL(`${settings.baseUrl}${path}`)
  for (const [key, value] of Object.entries(params ?? {})) {
    url.searchParams.set(key, value)
  }

  return fetchJson<T>(url.toString(), settings.token)
}

export async function listSavedViews(): Promise<SavedView[]> {
  const settings = requireSettings()

  const results: SavedView[] = []
  let page = await request<PaginatedResponse<SavedView>>('/api/saved_views/')
  results.push(...page.results.map((v) => ({ id: v.id, name: v.name })))

  let pagesFetched = 1
  while (page.next && pagesFetched < MAX_PAGES) {
    page = await fetchJson<PaginatedResponse<SavedView>>(page.next, settings.token)
    results.push(...page.results.map((v) => ({ id: v.id, name: v.name })))
    pagesFetched += 1
  }

  return results
}

export async function searchDocuments(query: string): Promise<PaperlessDocument[]> {
  const page = await request<PaginatedResponse<PaperlessDocument>>('/api/documents/', {
    query,
    page_size: '20',
  })
  return page.results
}

export function buildSavedViewUrl(baseUrl: string, id: number): string {
  return `${baseUrl}/view/${id}`
}

export function buildDocumentUrl(baseUrl: string, id: number): string {
  return `${baseUrl}/documents/${id}`
}

export async function fetchDocumentThumbnail(id: number): Promise<Blob> {
  const settings = requireSettings()
  return fetchBlob(`${settings.baseUrl}/api/documents/${id}/thumb/`, settings.token)
}
