export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface SavedView {
  id: number
  name: string
}

export interface PaperlessDocument {
  id: number
  title: string
  correspondent: number | string | null
  created: string
}
