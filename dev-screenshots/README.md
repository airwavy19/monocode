# dev-screenshots

Visual evidence for every PR that touches UI — scoped to the diff, not the
site. Code review alone doesn't catch a 2px misalignment; the eyeball does.
The default is **don't screenshot every page on every PR.** Capture only
the surfaces the diff actually changes.

## Layout

```
dev-screenshots/
├── capture.py      ← the script (you are here)
├── README.md       ← this file
├── .gitignore      ← excludes saved/ so stray runs don't pollute git
└── saved/          ← output (gitignored, force-added per PR)
    └── 2026-01-15_14-30/
        └── login-form-redesign/
            ├── 01-desktop.png
            ├── 02-mobile.png
            └── ...
```

`saved/` is gitignored by default. To attach a capture to a PR, force-add
the specific feature folder:

```bash
git add -f dev-screenshots/saved/2026-01-15_14-30/login-form-redesign
```

The screenshots stay committed after merge — they're the audit trail of
what shipped.

## Scope first — don't sweep

The smart default is **scope, not sweep**. Capture 2 focused screenshots
of the pages your diff touched, not 12 of the whole app.

**Screenshot required** — the diff is user-visible:

- A file under `pages/`, `routes/`, `views/`, `app/` (route-level code)
- A file under `layouts/`, `theme/`, `styles/`, `tokens/`, `globals.css` → capture the home page
- A file under `components/<Name>.tsx` that the diff shows is rendered on a specific page

**Screenshot optional** — capture only if the change is visible:

- A file under `components/shared/` or `components/ui/` (reusable atoms) → find usages, capture 1–2 representative pages
- A file under `hooks/`, `lib/`, `utils/` that's used by visible code → capture one page that exercises the change

**Screenshot skipped** — no UI surface, `## Visual evidence` omitted:

- `backend/`, `api/`, `services/`, `migrations/`, `db/`
- `tests/`, `__tests__/`, `*.test.*`, `*.spec.*`
- `*.config.*`, `package.json`, `requirements.txt`, `Cargo.toml`, `go.mod`
- Documentation (`.md`), `docs/`
- CI workflows (`.github/`), scripts, build config
- Refactor with zero behavior change (rename, move, re-export)

## capture.py

```bash
# minimal: single URL, desktop viewport
python3 dev-screenshots/capture.py login-form-redesign --url http://localhost:3000

# multi-URL: two pages in one run (numbered 01-, 02-, ...)
python3 dev-screenshots/capture.py login-form-redesign \
    --url http://localhost:3000/login \
    --url http://localhost:3000/signup

# mobile too
python3 dev-screenshots/capture.py login-form-redesign --url http://localhost:3000 --viewport mobile

# multi-step flow (Playwright only)
python3 dev-screenshots/capture.py login-form-redesign --url http://localhost:3000 \
    --steps "page.click('#login');page.fill('#email','a@b.co');page.click('#submit')"

# no browser on the agent box — print the path, save by hand
python3 dev-screenshots/capture.py login-form-redesign --url http://localhost:3000 --manual

# list captures
python3 dev-screenshots/capture.py list

# latest path for a feature (paste into PR body)
python3 dev-screenshots/capture.py last login-form-redesign

# categorize the diff vs main: routes to capture, components to trace, files to skip
python3 dev-screenshots/capture.py scope-diff
```

The script prints the saved path on stdout so the agent pastes it directly
into the PR description under `## Visual evidence`.

### scope-diff — let the script do the triage

```bash
python3 dev-screenshots/capture.py scope-diff
```

Output:

```
Files changed vs origin/main: 3

Routes to capture (1):
  frontend/src/pages/Settings.tsx

Components to trace (1):
  frontend/src/components/Toggle.tsx  → grep for usages; capture 1-2 representative pages

Skip screenshots (1 files):
  backend/services/auth.py
```

The agent runs `scope-diff` first, sees "Routes to capture (1): Settings.tsx",
then runs `capture.py <feature> --url http://localhost:3000/settings`. No
manual categorization. The script is the triage; the agent is the driver.

## Backends (auto-detected)

1. **Playwright** — `pip install playwright && playwright install chromium`. Best for flows (clicks, fills, multi-step), full-page captures, multiple viewports.
2. **chrome/chromium headless** — zero Python deps. Any of `google-chrome`, `chromium`, `chromium-browser`, `chrome` on `$PATH`. Single URL, fixed viewport.
3. **--manual** — no browser. Prints the target path so a human or a different box can save the screenshot.

## Viewport matrix

Default: capture **both desktop and mobile** for any user-visible change.

Skip mobile when the diff is desktop-only (wide-table layout, hover-only state).
Skip desktop when the diff is mobile-only (bottom-sheet, touch-only gesture).

## PR body

Every PR with a non-zero UI surface includes screenshots under `## Visual evidence`:

```markdown
## Visual evidence
![desktop](dev-screenshots/saved/2026-01-15_14-30/login-form-redesign/01-desktop.png)
![mobile](dev-screenshots/saved/2026-01-15_14-30/login-form-redesign/02-mobile.png)
```

GitHub renders PNG attachments from the repo, so the screenshot lives in
the PR viewer's diff. The `## Visual evidence` section is omitted only
when the PR has zero UI surface (backend-only, docs, CI) — never left empty.

## Failure modes this prevents

**Over-scope:** agent snapshots every page on every PR for "thoroughness."
CI takes 12 min instead of 2 min, screenshots pile up in `saved/`, the human
reviewer skims past the real change in the noise. Fix: scope to the diff.

**Under-scope:** agent ships a UI change, looks correct in the dev server,
the human reviewer clicks through and says "the spacing is wrong on mobile."
Fix: scope rules above — diff in `pages/Settings.tsx` → `/settings` is
required, screenshot ships with the PR.

## See also

`forward.md` → §7A Visual evidence — the rule this folder implements.
