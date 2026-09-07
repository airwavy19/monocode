# 260907-0531PM — Hi-def background default

## Problem

`9b92439` shipped a **Pixelated look** toggle on the session background but
left the toggle **on** by default. Most users (bundled `Miku` wallpaper or
any local JPEG/PNG/WebP) were seeing a deliberately degraded background
even though their source images are high resolution. The intended
highest-quality render was hidden behind a toggle most people never opened.

## Change

Flipped the default from pixelated → high definition. New installs and
existing users who never customised the background now see the image at
container resolution, smooth bilinear scaling, no Bayer dither pass,
`image-rendering: auto`.

Toggle stays. Settings → Appearance → Session background → **Pixelated look**
opts back into the dithered pixel-art treatment for those who want it.

## Files

- `src/lib/sessionArtwork.ts`
  - `DEFAULT_ARTWORK.pixelated: true → false`.
  - Added `LEGACY_DEFAULT_ARTWORK` snapshot of the previous default bundle.
  - Loader migration: a stored payload that matches the legacy default
    bundle is silently upgraded to `pixelated: false`. Custom images and
    explicit `pixelated: true` opt-ins are preserved.
- `src/surfaces/SessionArtwork.css`
  - Canvas default `image-rendering: pixelated → auto`. The inline style
    on the `<canvas>` still flips to `pixelated` when the toggle is on.
- `src/lib/sessionArtwork.test.ts`
  - Renamed "defaults to pixelated" → "defaults to high definition".
  - Added "migrates a legacy default-bundle save to high definition".
  - Renamed "preserves the native-resolution opt-out" → "preserves the
    pixel-art opt-in for a customised image" (now uses a `path` field to
    represent a real opt-in signal).
- `README.md`
  - Rewrote the **High-definition background by default** section to
    describe the new default and the migration.
- `CHANGELOG.md`
  - New `[Unreleased]` entry under `### Changed`.

## Verification

- `npx vitest run` → **126 files / 1306 tests pass**, including the three
  new / updated artwork tests.
- `npx tsc --noEmit` → clean.
- `npm run build` → success (built in 6.91s, dist unchanged in shape).

## Release

`v0.6.0 — high-definition background default` to ship as MINOR (new
default + migration behaviour). Cuts from `main`.
