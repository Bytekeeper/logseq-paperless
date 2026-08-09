# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Logseq plugin (`logseq-plugin-paperless`) that adds two slash commands for linking to a
[paperless-ngx](https://docs.paperless-ngx.com/) instance from Logseq blocks:

- **Paperless: Insert Saved View Link** — lists saved views, filtered client-side.
- **Paperless: Insert Document Link** — live debounced full-text document search via the
  paperless-ngx API, with thumbnails.

Both open a centered modal popup, let the user pick a result, and insert a markdown link at the
editing cursor.

## Commands

```sh
yarn install
yarn dev         # vite build --watch — rebuilds dist/ on save; Logseq picks it up via hot-reload
yarn build       # tsc --noEmit && vite build — typecheck + production build into dist/
yarn typecheck   # tsc --noEmit
yarn test        # vitest run
yarn coverage    # vitest run --coverage
```

Run a single test file: `yarn vitest run test/picker.test.ts`. Run by name: `yarn vitest run -t "some test name"`.

There is no dev server for this plugin — Logseq always loads the built `dist/` output (see
`yarn dev` above), never a live vite server. To manually verify a change in Logseq itself: enable
Developer mode (Settings → Advanced), then Plugins → **Load unpacked plugin** → this repo's root
(the folder containing `package.json`, whose `logseq.main` points at `dist/index.html`).

## Architecture

**Flow:** `main.ts` registers two slash commands (`src/commands/*.ts`). Each command handler:
checks settings are configured (`ensureConfigured` in `src/settings.ts`), calls the API client
(`src/api/paperless-client.ts`), opens a picker popup (`src/ui/popup-controller.ts` →
`src/ui/picker.ts`) with the results, and on selection inserts a markdown link
(`src/lib/markdown.ts`) via `logseq.Editor.insertAtEditingCursor`.

**API client** (`src/api/paperless-client.ts`) — thin fetch wrapper. All requests attach
`Authorization: Token <token>` and translate failure modes into a single `PaperlessApiError`
(`src/lib/errors.ts`), which is the sole source of truth for user-facing error copy
(`reportApiError`) — throw sites intentionally don't author their own messages. Saved views are
paginated and fully drained (capped at `MAX_PAGES`); document search returns one page (page 1,
20 results) since it's live/debounced as-you-type.

**Popup lifecycle** (`src/ui/popup-controller.ts`) is the one place that owns "the" active popup
across the whole plugin — opening a second command while one popup is open tears down the first
rather than leaving stale state. `logseq.setMainUIInlineStyle` only sizes the *outer* iframe
Logseq embeds for the plugin's main UI; centering the popup content inside it is a separate CSS
concern (`.paperless-overlay` in `src/ui/picker.css`), and only works once the outer iframe
actually spans the viewport.

**Picker** (`src/ui/picker.ts`) is a generic, non-Logseq-specific list-filter-select widget
(keyboard nav, mouse hover/click, request-token-guarded async `fetchItems`). It's reused by both
commands via `PickerOptions<T>`, with `renderItem` supplied per-command (plain text for saved
views; a thumbnail + label row for documents, with thumbnails cached per popup-invocation and
revoked on close — see `insert-document-link.ts`).

**Settings** (`src/settings.ts`) defines the Logseq settings schema (base URL + API token) and
`getPaperlessSettings`/`ensureConfigured` helpers used by both commands and the API client.

## Testing

Tests run under `vitest` + `jsdom`. `vitest.config.ts` is deliberately separate from
`vite.config.ts` — `vite-plugin-logseq`'s dev-server hook assumes a real `httpServer`, which
breaks vitest's internal test server, so tests don't load that plugin at all.

`test/support/mock-logseq.ts` stubs the global `logseq` SDK object (settings, `UI.showMsg`,
`Editor.registerSlashCommand`/`insertAtEditingCursor`, `showMainUI`/`hideMainUI`/
`setMainUIInlineStyle`) and captures registered slash-command handlers by name so tests can
invoke them directly. `test/support/dom-events.ts` has small helpers for firing keyboard/input
events and flushing a microtask tick.

What isn't covered by unit tests (real `/` menu discoverability, actual popup positioning/focus
in Logseq, settings UI rendering, live auth/CORS behavior) is covered by the manual checklist in
the README's Install/Usage sections instead.
