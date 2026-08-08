import { describe, it, expect, vi, afterEach } from 'vitest'
import { Picker, type PickerOptions } from '../src/ui/picker'
import { flush, fireKey, fireInput } from './support/dom-events'

interface Item {
  id: number
  name: string
}

const ITEMS: Item[] = [
  { id: 1, name: 'Invoices' },
  { id: 2, name: 'Receipts' },
  { id: 3, name: 'Taxes' },
]

describe('Picker', () => {
  let container: HTMLDivElement

  afterEach(() => {
    container?.remove()
  })

  function setup(overrides: Partial<PickerOptions<Item>> = {}) {
    container = document.createElement('div')
    document.body.appendChild(container)

    const onSelect = vi.fn()
    const onCancel = vi.fn()
    const fetchItems = vi.fn(async (query: string) =>
      ITEMS.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
    )

    const renderItem = vi.fn((i: Item, li: HTMLLIElement) => {
      li.textContent = i.name
    })

    const picker = new Picker<Item>({
      placeholder: 'Filter…',
      fetchItems,
      renderItem,
      getItemKey: (i) => String(i.id),
      onSelect,
      onCancel,
      ...overrides,
    })
    picker.mount(container)

    const input = container.querySelector('input') as HTMLInputElement
    return { picker, input, container, onSelect, onCancel, fetchItems, renderItem }
  }

  it('loads the initial item list on mount', async () => {
    const { container, fetchItems } = setup()
    await flush()

    expect(fetchItems).toHaveBeenCalledWith('')
    const rendered = container.querySelectorAll('.paperless-picker-item')
    expect(rendered).toHaveLength(3)
  })

  it('filters the list as the user types', async () => {
    const { input, container } = setup()
    await flush()

    fireInput(input, 'rec')
    await flush()

    const rendered = container.querySelectorAll('.paperless-picker-item')
    expect(rendered).toHaveLength(1)
    expect(rendered[0].textContent).toBe('Receipts')
  })

  it('moves the highlight with arrow keys and selects with Enter', async () => {
    const { input, onSelect } = setup()
    await flush()

    fireKey(input, 'ArrowDown')
    fireKey(input, 'ArrowDown')
    fireKey(input, 'Enter')

    expect(onSelect).toHaveBeenCalledWith(ITEMS[2])
  })

  it('moves the highlight back up with ArrowUp', async () => {
    const { input, onSelect } = setup()
    await flush()

    fireKey(input, 'ArrowDown')
    fireKey(input, 'ArrowDown')
    fireKey(input, 'ArrowUp')
    fireKey(input, 'Enter')

    expect(onSelect).toHaveBeenCalledWith(ITEMS[1])
  })

  it('does not move the highlight above the first item', async () => {
    const { input, onSelect } = setup()
    await flush()

    fireKey(input, 'ArrowUp')
    fireKey(input, 'ArrowUp')
    fireKey(input, 'Enter')

    expect(onSelect).toHaveBeenCalledWith(ITEMS[0])
  })

  it('moving the highlight does not re-invoke renderItem for existing rows', async () => {
    const { input, container, renderItem } = setup()
    await flush()

    renderItem.mockClear()
    fireKey(input, 'ArrowDown')
    fireKey(input, 'ArrowDown')

    expect(renderItem).not.toHaveBeenCalled()
    const highlighted = container.querySelector('.is-highlighted')
    expect(highlighted?.textContent).toBe('Taxes')
  })

  it('does not move the highlight past the last item', async () => {
    const { input, onSelect } = setup()
    await flush()

    for (let i = 0; i < 10; i++) fireKey(input, 'ArrowDown')
    fireKey(input, 'Enter')

    expect(onSelect).toHaveBeenCalledWith(ITEMS[2])
  })

  it('calls onCancel on Escape', async () => {
    const { input, onCancel } = setup()
    await flush()

    fireKey(input, 'Escape')

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onCancel when the close button is clicked', async () => {
    const { container, onCancel } = setup()
    await flush()

    const closeButton = container.querySelector<HTMLButtonElement>('.paperless-picker-close')
    closeButton?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('selects an item on mousedown', async () => {
    const { container, onSelect } = setup()
    await flush()

    const items = container.querySelectorAll<HTMLLIElement>('.paperless-picker-item')
    items[1].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))

    expect(onSelect).toHaveBeenCalledWith(ITEMS[1])
  })

  it('moves the highlight to whatever the mouse hovers, even after keyboard navigation', async () => {
    const { input, container, onSelect } = setup()
    await flush()

    // keyboard moves highlight to index 2 ("Taxes")
    fireKey(input, 'ArrowDown')
    fireKey(input, 'ArrowDown')
    let highlighted = container.querySelector('.is-highlighted')
    expect(highlighted?.textContent).toBe('Taxes')

    // hovering a different row should move the highlight to match it
    const items = container.querySelectorAll<HTMLLIElement>('.paperless-picker-item')
    items[0].dispatchEvent(new MouseEvent('mouseenter'))
    highlighted = container.querySelector('.is-highlighted')
    expect(highlighted?.textContent).toBe('Invoices')

    // clicking should select whatever is now highlighted (the hovered row), not the stale one
    items[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    expect(onSelect).toHaveBeenCalledWith(ITEMS[0])
  })

  it('ignores stale results from an earlier, slower request', async () => {
    let resolveFirst: (items: Item[]) => void = () => {}
    const fetchItems = vi
      .fn()
      .mockImplementationOnce(
        () => new Promise<Item[]>((resolve) => { resolveFirst = resolve })
      )
      .mockImplementationOnce(async () => [ITEMS[0]])

    const { input, container } = setup({ fetchItems })
    await flush()

    fireInput(input, 'a')
    await flush()

    // second (faster) request resolves first
    expect(container.querySelectorAll('.paperless-picker-item')).toHaveLength(1)

    // stale first request resolves after — must not clobber the newer results
    resolveFirst(ITEMS)
    await flush()

    expect(container.querySelectorAll('.paperless-picker-item')).toHaveLength(1)
  })

  it('calls onError and clears the list when fetchItems rejects', async () => {
    const onError = vi.fn()
    const err = new Error('boom')
    const fetchItems = vi.fn().mockResolvedValueOnce(ITEMS).mockRejectedValueOnce(err)

    const { input, container } = setup({ fetchItems, onError })
    await flush()

    fireInput(input, 'x')
    await flush()

    expect(onError).toHaveBeenCalledWith(err)
    expect(container.querySelectorAll('.paperless-picker-item')).toHaveLength(0)
  })

  it('removes its DOM and listeners on destroy', async () => {
    const { picker, container } = setup()
    await flush()

    picker.destroy()

    expect(container.querySelector('.paperless-picker')).toBeNull()
  })
})
