# 260906-0717PM — `/new` slash command

## Context

User complaint: typing `/new` in the composer opens the slash picker and
suggests creating a new *skill* named "new", instead of starting a new
chat. The workaround (sidebar → New Session) takes about five clicks.
Worth fixing because `/plan` and `/compact` already use the same slash
shortcut pattern.

Repo: `/home/popwavy/Documents/monocode`. Base: `c8b6374` (on top of v0.2.0).
Working tree clean.

## Plan

- New builtin skill `NEW_COMMAND` next to `PLAN_COMMAND` and
  `COMPACT_COMMAND`. New module `src/lib/newSession.ts` so future
  reservation changes have one place to land.
- `isNewCommand(text)` matcher matches a standalone `/new` (with optional
  leading whitespace / case-insensitive), same regex style as
  `isCompactCommand`.
- `Composer.submit()` checks `isNewCommand(value)` before the normal prompt
  flow; when it matches, calls `onNewSession?.()`, clears the draft, closes
  the picker.
- Slash picker prepends `NEW_COMMAND` and the existing `rankSkills` query
  handles ordering with the user query.
- Thread `onNewSession` through `SessionPane` and `PaneTree` to the App's
  existing `onNew` handler (which already creates a tab, appends it,
  focuses the composer).

## Implementation notes

- App's `onNew` already returns the new session id; the composer doesn't
  need it. The SessionPane bridges `() => onNewSession(session.id)` for
  the current session id (kept as a parameter so a future per-tab
  re-target stays trivial).
- PaneTree had to gain an `onNewSession` prop (typed alongside
  `onCompactContext`) because it also renders SessionPane. TypeScript
  surfaced the missing prop on first compile.
- Skipping the create-skill flow when `/new` is typed: the picker shows
  `/new` as a real builtin entry, so the "Create new skill" affordance
  never gets a chance to fire for that query.

## Verification

```
$ npm run check:web
 Test Files  124 passed (124)
      Tests  1286 passed (1286)
```

- 3 new tests in `src/lib/newSession.test.ts`
- `src/chrome/SkillPicker.test.ts` updated to assert `/new` renders
- tsc clean

## Versioning

- New command surface = `feat:` = MINOR.
- `0.2.0` → `0.3.0` via `npm run set-version -- 0.3.0`. All version files
  updated.

## Release

- Commit: `c8b6374` (`feat(composer): /new slash command starts a fresh session`).
- Tag: `v0.3.0`. Title: `v0.3.0 — /new slash command`.
- Release body: 2,723 bytes; sections TL;DR / per-issue breakdown /
  operator workflow / env vars / rollback / full diff link.

## Files touched

- `src/lib/newSession.ts` — new file.
- `src/lib/newSession.test.ts` — new file.
- `src/chrome/Composer.tsx` — import, slashItems prepend, `onNewSession` prop, submit branch.
- `src/chrome/SkillPicker.test.ts` — assert `/new` renders.
- `src/surfaces/SessionPane.tsx` — `onNewSession` prop + bridge.
- `src/surfaces/PaneTree.tsx` — `onNewSession` prop + bridge.
- `src/App.tsx` — passes `() => onNew()` through PaneTree.
- `README.md`, `CHANGELOG.md`.
- `package.json`, `package-lock.json`, `Cargo.toml`, `Cargo.lock`,
  `src-tauri/tauri.conf.json` — version bump.
