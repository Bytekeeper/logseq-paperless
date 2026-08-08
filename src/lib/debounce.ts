export function debounce<Args extends unknown[], R>(
  fn: (...args: Args) => Promise<R> | R,
  delay: number
): (...args: Args) => Promise<R> {
  let timer: ReturnType<typeof setTimeout> | undefined

  return (...args: Args) =>
    new Promise<R>((resolve, reject) => {
      if (timer !== undefined) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = undefined
        Promise.resolve(fn(...args)).then(resolve, reject)
      }, delay)
    })
}
