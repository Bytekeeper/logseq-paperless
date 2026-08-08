import { vi } from 'vitest'

/**
 * Stubs the global `logseq` plugin SDK object with the full surface the slash-command
 * modules touch, and returns the map slash-command handlers get registered into so tests
 * can invoke them directly by command name.
 */
export function mockLogseq(settings: Record<string, unknown>) {
  const handlers: Record<string, (...args: unknown[]) => unknown> = {}
  ;(globalThis as any).logseq = {
    settings,
    UI: { showMsg: vi.fn() },
    Editor: {
      registerSlashCommand: vi.fn((tag: string, handler: (...args: unknown[]) => unknown) => {
        handlers[tag] = handler
      }),
      insertAtEditingCursor: vi.fn(async () => {}),
    },
    showMainUI: vi.fn(),
    hideMainUI: vi.fn(),
    setMainUIInlineStyle: vi.fn(),
  }
  return handlers
}
