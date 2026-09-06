# 260906-0710PM — show-thinking toggle + Linux image paste

## Context

User on PopOS reported two chat-input gaps in MonoCode while driving the Pi harness:

1. Pi reasoning had no visibility toggle. Reasoning blocks were already being
   captured (`reasoning.delta` in `piFamily.ts`) and folded inside phases
   (`ActivityThinkingRow`), but there was no setting to keep them inline or
   hide them entirely. Pi and omp both stream thinking; Codex, Claude, and
   OpenCode do the same. A global toggle was the right shape.
2. Pasting images on Linux was a no-op. The composer paste handler in
   `src/chrome/Composer.tsx` only consulted `e.clipboardData.files` and
   `.items`. On X11/Wayland, the GTK clipboard exposes a copied screenshot
   as `text/uri-list` with a `file:///tmp/...png` URI rather than as a File,
   so the webview surfaces it as text and `filesFromClipboard` returns `[]`.
   Drag-and-drop already worked because Tauri hands the app the native path.

Repo: `/home/popwavy/Documents/monocode`. Base: `902574e` (clean on `main`).

## Plan

- New `monocode.showThinking` setting in `src/lib/settings.ts` with values
  `"on" | "off"`, default `"on"`. Broadcast via a
  `monocode:show-thinking-change` window event for cross-component updates.
- New `useShowThinking` hook under `src/hooks/`.
- `AgentTranscript` filters `role: "reasoning"` blocks out before
  `groupTurns(...)` runs when the toggle is off. InitialThinking never
  renders (no all-thinking items exist) and ActivityThinkingRow never fires
  inside phases (no reasoning blocks reach `buildActivityPhases`).
- SettingsView gains a **Show thinking** segmented control under General.
- Global keybinding `Ctrl/Cmd + Shift + T` (`MOD + SHIFT + T`); declared in
  `KEYBINDINGS` as `View: Toggle Thinking`. Existing `MOD + T` (Tab: New)
  and `MOD + ALT + T` (Tab: Close Others) made `MOD + ALT + T` off-limits,
  so the modifier combo had to land on Shift.
- New `pathsFromClipboard` in `src/lib/attachments.ts` walks
  `text/uri-list` then `text/plain`, decodes percent-encoding, drops
  non-`file://` schemes, de-duplicates across sources, returns POSIX paths.
- Composer paste handler runs both `filesFromClipboard` and
  `pathsFromClipboard`; URI paths flow through the existing
  `attachmentsFromPaths` so PNGs under 20 MB still get inlined as base64
  for vision-capable models.
- Tests: 6 new cases in `src/lib/attachments.test.ts` for URI parsing.

## Implementation notes

- `ClipboardLike` widened to accept optional `getData(type)` so existing
  macOS callers stay untouched.
- `filePathFromUri` decodes percent encoding via `decodeURI` (handles
  filenames with spaces and unicode).
- The keybinding test in `src/lib/settings.test.ts` filters with
  `command.startsWith("Session:")` — initial draft "Session: Toggle
  Thinking" tripped it; renamed to "View: Toggle Thinking" to match the
  App/Search/Tab/View/Pane family.

## Verification

```
npm run check:web
 Test Files  123 passed (123)
      Tests  1283 passed (1283)
```

Includes 6 new `pathsFromClipboard` tests and the existing
`filesFromClipboard` cases (the signature widening kept them green).

`tsc --noEmit` clean.

## Versioning

- Feature (toggle) is `feat:`.
- Paste bug is effectively a `fix:` for Linux parity.
- Composite impact: MINOR bump. `0.1.34` → `0.2.0` via
  `npm run set-version -- 0.2.0`. All version files updated.

## Release

- Commit: `89c7d2f` (`feat: show-thinking toggle and Linux image paste`).
- Follow-up commit: `6515597` (`docs: link v0.2.0 in CHANGELOG footer`).
- Tag: `v0.2.0`. Title: `v0.2.0 — show-thinking toggle + Linux image paste`.
- Release body: 4,941 bytes; sections TL;DR / per-issue breakdown /
  operator workflow / env vars / rollback / full diff link.
- Upstream `airwavy19/monocode` has issues disabled, so the planned
  GH issue could not be filed. Plan captured in this diary instead.

## Files touched

- `src/lib/settings.ts` — setting + change event + subscribe + keybinding row.
- `src/hooks/useShowThinking.ts` — new file.
- `src/surfaces/AgentTranscript.tsx` — `useShowThinking()` + `displayBlocks` filter.
- `src/surfaces/SettingsView.tsx` — toggle row + handler + import.
- `src/App.tsx` — `Ctrl/Cmd+Shift+T` handler.
- `src/lib/attachments.ts` — `pathsFromClipboard` + helpers.
- `src/chrome/Composer.tsx` — paste handler picks up URI paths.
- `src/lib/attachments.test.ts` — 6 new cases.
- `README.md` — operator-facing notes on both features.
- `CHANGELOG.md` — `[0.2.0] - 2026-09-06` section + footer links.
- `package.json`, `package-lock.json`, `Cargo.toml`, `Cargo.lock`,
  `src-tauri/tauri.conf.json` — version bump.
