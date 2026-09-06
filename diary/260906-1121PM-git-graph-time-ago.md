# 260906-1121PM — git graph time-ago pill

## Context

User feedback: the source-control graph shows commit subject, author, and
ref tag, but no relative time. Each row leaves you squinting at the SHA
and counting backwards. The Tauri backend already carries the
`timestamp` (Unix seconds from `git log --format=%ct`); the React side just
never rendered it.

Repo: `/home/popwavy/Documents/monocode`. Base: `b4e88bb` (on top of v0.3.0).
Working tree clean.

## Plan

- Extract `formatRelativeTime` from `src/lib/githubTasks.ts` into a new
  `src/lib/relativeTime.ts`. Add a `formatRelativeTimeShort` companion that
  returns compact forms (`now`, `5m`, `3h`, `2d`, `3w`, `5mo`, `2y`).
- Widened the signature to accept Unix seconds, Unix milliseconds, ISO
  strings, or `Date` objects so the git helper, notes, and inbox all share
  one implementation.
- `githubTasks.ts` re-exports both helpers — existing call sites untouched.
- `GitHistoryGraph` renders a small `text-content/45` pill between the
  author and the ref tag. Title attribute carries the verbose form.
- A `useState`/`useEffect` pair ticks every 60 s so the labels stay fresh
  without re-fetching git log.

## Implementation notes

- `toMillis(value)` normalises input: numbers under `1e12` are treated as
  seconds (git's range), above as milliseconds (JS `Date.now()` range).
- Clock-skew on the local box would briefly show "future" timestamps; the
  graph is ordered newest-first so we collapse any positive delta back to
  the past form (`amount > 0 ? "${n}${suffix}" : "now"`).
- Placement chosen between author and ref pill: leaves the ref pill as the
  rightmost, most-anchored element; author stays close to the subject for
  context; the time pill sits in the natural reading gap.
- Used `tabular-nums` on the pill so "5m" / "55m" don't shift width as the
  tick advances.

## Verification

```
$ npm run check:web
 Test Files  125 passed (125)
      Tests  1298 passed (1298)
```

12 new tests in `src/lib/relativeTime.test.ts` cover each band, all four
input shapes (seconds/milliseconds/ISO/Date), and invalid values.

## Versioning

- New visible UI affordance = `feat:` = MINOR.
- `0.3.0` → `0.4.0` via `npm run set-version -- 0.4.0`. All version files
  updated.

## Release

- Commit: `8f2a4bb` (`feat(graph): compact time-ago pill on each git commit row`).
- Tag: `v0.4.0`. Title: `v0.4.0 — git graph time-ago pills`.
- Release body: 2,916 bytes; full diff link, rollback steps, operator
  workflow change.

## Files touched

- `src/lib/relativeTime.ts` — new file.
- `src/lib/relativeTime.test.ts` — new file.
- `src/lib/githubTasks.ts` — re-exports both helpers.
- `src/chrome/GitHistoryGraph.tsx` — `TimeAgo` component + per-minute tick.
- `README.md`, `CHANGELOG.md`.
- `package.json`, `package-lock.json`, `Cargo.toml`, `Cargo.lock`,
  `src-tauri/tauri.conf.json` — version bump.
