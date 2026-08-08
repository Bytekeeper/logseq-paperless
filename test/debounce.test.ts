import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { debounce } from '../src/lib/debounce'

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('only invokes the wrapped function once, with the last call\'s args, within the window', async () => {
    const fn = vi.fn(async (x: number) => x * 2)
    const debounced = debounce(fn, 300)

    debounced(1)
    debounced(2)
    const resultPromise = debounced(3)

    expect(fn).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(300)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith(3)
    await expect(resultPromise).resolves.toBe(6)
  })

  it('invokes again once the delay has fully elapsed', async () => {
    const fn = vi.fn(async (x: number) => x)
    const debounced = debounce(fn, 300)

    const first = debounced(1)
    await vi.advanceTimersByTimeAsync(300)
    await expect(first).resolves.toBe(1)

    const second = debounced(2)
    await vi.advanceTimersByTimeAsync(300)
    await expect(second).resolves.toBe(2)

    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('propagates a rejection from the wrapped function', async () => {
    const err = new Error('boom')
    const fn = vi.fn(async () => {
      throw err
    })
    const debounced = debounce(fn, 300)

    const result = debounced()
    const assertion = expect(result).rejects.toBe(err)
    await vi.advanceTimersByTimeAsync(300)

    await assertion
  })
})
