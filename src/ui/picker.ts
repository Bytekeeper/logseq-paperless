export interface PickerOptions<T> {
  placeholder: string
  fetchItems: (query: string) => Promise<T[]>
  renderItem: (item: T, container: HTMLLIElement) => void
  getItemKey: (item: T) => string
  onSelect: (item: T) => void
  onCancel: () => void
  onError?: (err: unknown) => void
}

export class Picker<T> {
  private opts: PickerOptions<T>
  private root: HTMLDivElement | null = null
  private input: HTMLInputElement | null = null
  private list: HTMLUListElement | null = null
  private items: T[] = []
  private highlighted = 0
  private requestToken = 0

  constructor(opts: PickerOptions<T>) {
    this.opts = opts
  }

  mount(container: HTMLElement): void {
    const root = document.createElement('div')
    root.className = 'paperless-picker'

    const header = document.createElement('div')
    header.className = 'paperless-picker-header'

    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'paperless-picker-input'
    input.placeholder = this.opts.placeholder

    const closeButton = document.createElement('button')
    closeButton.type = 'button'
    closeButton.className = 'paperless-picker-close'
    closeButton.setAttribute('aria-label', 'Cancel')
    closeButton.textContent = '✕'
    closeButton.addEventListener('mousedown', (e) => {
      e.preventDefault()
      this.opts.onCancel()
    })

    header.appendChild(input)
    header.appendChild(closeButton)

    const list = document.createElement('ul')
    list.className = 'paperless-picker-list'

    root.appendChild(header)
    root.appendChild(list)
    container.appendChild(root)

    this.root = root
    this.input = input
    this.list = list

    input.addEventListener('input', this.handleInput)
    input.addEventListener('keydown', this.handleKeydown)

    // logseq.showMainUI() makes the host reveal our iframe asynchronously (a postMessage
    // round-trip), so a synchronous focus() call here — in the same tick mount() is called
    // from — fires while the iframe is still effectively hidden and gets silently dropped.
    // Deferring it lets that round-trip complete first.
    setTimeout(() => this.input?.focus(), 50)
    void this.handleInput()
  }

  destroy(): void {
    this.input?.removeEventListener('input', this.handleInput)
    this.input?.removeEventListener('keydown', this.handleKeydown)
    this.root?.remove()
    this.root = null
    this.input = null
    this.list = null
  }

  private handleInput = async (): Promise<void> => {
    const query = this.input?.value ?? ''
    const token = ++this.requestToken

    let results: T[]
    try {
      results = await this.opts.fetchItems(query)
    } catch (err) {
      if (token !== this.requestToken) return
      this.items = []
      this.highlighted = 0
      this.render()
      this.opts.onError?.(err)
      return
    }

    if (token !== this.requestToken) return
    this.items = results
    this.highlighted = 0
    this.render()
  }

  private handleKeydown = (e: KeyboardEvent): void => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (this.items.length > 0) {
          this.highlighted = Math.min(this.highlighted + 1, this.items.length - 1)
          this.updateHighlightClasses()
        }
        return
      case 'ArrowUp':
        e.preventDefault()
        if (this.items.length > 0) {
          this.highlighted = Math.max(this.highlighted - 1, 0)
          this.updateHighlightClasses()
        }
        return
      case 'Enter': {
        e.preventDefault()
        const selected = this.items[this.highlighted]
        if (selected) this.opts.onSelect(selected)
        return
      }
      case 'Escape':
        e.preventDefault()
        this.opts.onCancel()
        return
    }
  }

  // Rebuilds the list from `this.items`. Only called when the item set itself changes
  // (a new fetchItems result) — moving the highlight must NOT go through here, since
  // renderItem can have side effects (e.g. fetching a thumbnail image).
  private render(): void {
    if (!this.list) return
    this.list.innerHTML = ''

    this.items.forEach((item, index) => {
      const li = document.createElement('li')
      li.className = 'paperless-picker-item'
      li.dataset.key = this.opts.getItemKey(item)
      this.opts.renderItem(item, li)
      li.addEventListener('mouseenter', () => {
        this.highlighted = index
        this.updateHighlightClasses()
      })
      li.addEventListener('mousedown', (e) => {
        e.preventDefault()
        this.opts.onSelect(item)
      })
      this.list!.appendChild(li)
    })

    this.updateHighlightClasses()
  }

  private updateHighlightClasses(): void {
    if (!this.list) return
    Array.from(this.list.children).forEach((el, index) => {
      el.classList.toggle('is-highlighted', index === this.highlighted)
    })
  }
}
