#!/usr/bin/env python3
"""
capture.py — visual evidence for PRs.

Saves screenshots to:
  <repo>/dev-screenshots/saved/<YYYY-MM-DD_HH-MM>/<feature-name>/<step>-<viewport>.png

Backends (picked at runtime, first match wins):
  1. Playwright  — pip install playwright && playwright install chromium
                   Best for flows (--steps), full-page, multiple viewports.
  2. chrome/chromium headless  — zero Python deps, single URL.
                   Any of: google-chrome, chromium, chromium-browser, chrome.
  3. --manual     — prints the target path; you save the screenshot by hand
                   (use when the agent has no browser but the human does).

Usage:
  python3 dev-screenshots/capture.py <feature-name> --url <url>
  python3 dev-screenshots/capture.py <feature-name> --url <url> --viewport mobile
  python3 dev-screenshots/capture.py <feature-name> --url <url> \\
      --steps "page.click('#login');page.fill('#email','a@b.co');page.click('#submit')"
  python3 dev-screenshots/capture.py <feature-name> --url <url> --manual
  python3 dev-screenshots/capture.py --list        # print today's captures
  python3 dev-screenshots/capture.py --last <feature>  # print latest capture path

The script prints the saved path on stdout so the agent can paste it
directly into the PR description under `## Visual evidence`.

# AGENTS: backends are probed in import order. Playwright is the only one
# that supports --steps (clicks, fills, scrolls). chrome/chromium headless
# is the zero-dep fallback — single URL, fixed viewport. --manual is the
# last resort so the agent never silently fails. The eval() in capture_steps
# is intentional: steps are agent-written, not user-supplied; sandboxed
# agents write nothing user-controlled here. If you extend --steps to
# accept user input, replace eval() with an explicit action parser.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import os
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SAVED = HERE / "saved"

VIEWPORTS = {
    "desktop": (1440, 900),
    "mobile": (390, 844),
    "tablet": (820, 1180),
}

CHROME_BINARIES = ("google-chrome", "chromium", "chromium-browser", "chrome")


def now_slug() -> str:
    return _dt.datetime.now().strftime("%Y-%m-%d_%H-%M")


def out_dir(feature: str, when: str | None = None) -> Path:
    when = when or now_slug()
    d = SAVED / when / feature
    d.mkdir(parents=True, exist_ok=True)
    return d


def detect_backend() -> str | None:
    """Return 'playwright', a chrome binary name, or None."""
    try:
        import playwright.sync_api  # noqa: F401

        return "playwright"
    except ImportError:
        pass
    for cmd in CHROME_BINARIES:
        if shutil.which(cmd):
            return cmd
    return None


def capture_chrome(cmd: str, url: str, out_path: Path, w: int, h: int) -> None:
    subprocess.run(
        [
            cmd,
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--hide-scrollbars",
            f"--window-size={w},{h}",
            f"--screenshot={out_path}",
            url,
        ],
        check=True,
    )


def capture_playwright(
    url: str, out_path: Path, w: int, h: int, steps: list[str]
) -> None:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(viewport={"width": w, "height": h})
        page = context.new_page()
        page.goto(url, wait_until="networkidle")
        for step in steps:
            # ponytail: eval is agent-side; replace with an explicit DSL
            # if --steps ever takes user input.
            eval(step, {"page": page})  # noqa: S307
        page.screenshot(path=str(out_path), full_page=True)
        browser.close()


def cmd_capture(args: argparse.Namespace) -> int:
    out = out_dir(args.feature)
    w, h = VIEWPORTS[args.viewport]
    urls = args.url if isinstance(args.url, list) else [args.url]
    urls = [u for u in urls if u]
    if not urls:
        print("ERR: at least one --url required", file=sys.stderr)
        return 2

    if args.manual:
        for i, url in enumerate(urls, 1):
            fname = f"{i:02d}-{args.viewport}.png"
            target = out / fname
            print(f"Save manually to: {target}  (url: {url})")
        print(f"  mkdir -p {out}")
        return 0

    backend = detect_backend()
    if backend is None:
        print(
            "ERR: no backend available. Install playwright + chromium, "
            "or install google-chrome, or pass --manual.",
            file=sys.stderr,
        )
        print(f"mkdir -p {out}", file=sys.stderr)
        return 1

    steps = [s.strip() for s in (args.steps or "").split(";") if s.strip()]
    paths: list[Path] = []
    for i, url in enumerate(urls, 1):
        fname = f"{i:02d}-{args.viewport}.png"
        target = out / fname
        if backend == "playwright":
            try:
                capture_playwright(url, target, w, h, steps)
            except Exception as exc:
                print(f"ERR: playwright capture failed for {url}: {exc}", file=sys.stderr)
                return 1
        else:
            try:
                capture_chrome(backend, url, target, w, h)
            except Exception as exc:
                print(f"ERR: headless capture failed for {url}: {exc}", file=sys.stderr)
                return 1
        paths.append(target)
        print(target)

    return 0


def cmd_list(_: argparse.Namespace) -> int:
    if not SAVED.exists():
        print("(no saved captures yet)")
        return 0
    found = 0
    for ts_dir in sorted(SAVED.iterdir(), reverse=True):
        if not ts_dir.is_dir():
            continue
        for feat_dir in sorted(ts_dir.iterdir()):
            if not feat_dir.is_dir():
                continue
            pngs = list(feat_dir.glob("*.png"))
            print(f"{ts_dir.name}/{feat_dir.name}/  ({len(pngs)} png)")
            found += 1
    if found == 0:
        print("(no saved captures yet)")
    return 0


def cmd_last(args: argparse.Namespace) -> int:
    if not SAVED.exists():
        print("(no saved captures yet)")
        return 1
    matches = sorted(SAVED.glob(f"*/{args.feature}"), reverse=True)
    if not matches:
        print(f"No capture found for feature={args.feature!r}", file=sys.stderr)
        return 1
    latest = matches[0]
    for png in sorted(latest.glob("*.png")):
        print(png)
    return 0


def cmd_scope_diff(args: argparse.Namespace) -> int:
    """Print changed files vs `args.base`, grouped by UI surface.

    Categorization per forward.md → §7A:
      - Routes to capture:     files under pages/ routes/ views/ app/ layouts/ theme/
                               styles/ tokens/ globals.css
      - Components to trace:   files under components/ (find usages, 1-2 pages)
      - Skip screenshots:      backend/, api/, services/, migrations/, db/, tests/,
                               *.config.*, package.json, requirements.txt, *.md, docs/
    """
    try:
        proc = subprocess.run(
            ["git", "diff", "--name-only", f"{args.base}...HEAD"],
            capture_output=True,
            text=True,
            check=True,
        )
    except subprocess.CalledProcessError as exc:
        print(
            f"ERR: git diff failed: {exc.stderr.strip() or exc}",
            file=sys.stderr,
        )
        return 1

    files = [ln.strip() for ln in proc.stdout.splitlines() if ln.strip()]
    if not files:
        print(f"(no changes vs {args.base})")
        return 0

    skip_patterns = (
        "backend/",
        "api/",
        "services/",
        "migrations/",
        "db/",
        "tests/",
        "__tests__/",
        ".github/",
        "scripts/",
        "docs/",
    )
    skip_exts = (
        ".md",
        ".lock",
        ".sum",
        ".toml",
        ".yaml",
        ".yml",
        ".json",  # package.json etc.
    )
    skip_exact = {
        "package.json",
        "package-lock.json",
        "pnpm-lock.yaml",
        "yarn.lock",
        "requirements.txt",
        "Cargo.toml",
        "go.mod",
        "go.sum",
        "pyproject.toml",
    }

    routes: list[str] = []
    components: list[str] = []
    skip: list[str] = []

    for f in files:
        name = Path(f).name
        if name in skip_exact or any(
            f.endswith(ext) for ext in skip_exts
        ) or any(f.startswith(p) for p in skip_patterns):
            skip.append(f)
            continue
        if any(seg in f for seg in ("/pages/", "/routes/", "/views/", "/app/")):
            routes.append(f)
        elif any(
            seg in f
            for seg in ("/layouts/", "/theme/", "/styles/", "/tokens/")
        ) or name == "globals.css":
            routes.append(f + "  → global surface; capture home page")
        elif "/components/" in f:
            components.append(f)
        else:
            skip.append(f)

    print(f"Files changed vs {args.base}: {len(files)}")
    if routes:
        print(f"\nRoutes to capture ({len(routes)}):")
        for r in routes:
            print(f"  {r}")
    if components:
        print(f"\nComponents to trace ({len(components)}):")
        for c in components:
            print(f"  {c}  → grep for usages; capture 1-2 representative pages")
    if skip:
        print(f"\nSkip screenshots ({len(skip)} files):")
        for s in skip:
            print(f"  {s}")

    if not routes and not components:
        print("\nNo user-visible surface in this diff. `## Visual evidence` section is omitted.")
    return 0


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(
        description="Capture screenshots for PR visual evidence.",
    )
    sub = ap.add_subparsers(dest="cmd", required=False)

    p_cap = sub.add_parser("capture", help="capture a screenshot (default)")
    p_cap.add_argument("feature", help="feature-name slug, e.g. login-form-redesign")
    p_cap.add_argument(
        "--url",
        action="append",
        required=True,
        help="URL to capture. Repeatable: --url A --url B captures A then B "
             "as 01-desktop.png and 02-desktop.png in the same feature folder.",
    )
    p_cap.add_argument("--viewport", choices=list(VIEWPORTS), default="desktop")
    p_cap.add_argument(
        "--steps",
        default="",
        help="semicolon-separated Playwright steps (page.click('#x');page.fill('#y','z'))",
    )
    p_cap.add_argument(
        "--manual", action="store_true", help="print the path; you save manually"
    )

    sub.add_parser("list", help="list all saved captures")

    p_last = sub.add_parser("last", help="print latest capture paths for a feature")
    p_last.add_argument("feature")

    p_scope = sub.add_parser(
        "scope-diff",
        help="Print git diff vs main, grouped by UI surface "
             "(routes to capture, components to trace, files to skip)",
    )
    p_scope.add_argument(
        "--base",
        default="origin/main",
        help="Git base ref to diff against. Default: origin/main.",
    )

    # Back-compat: bare `capture.py <feature> --url X` (no subcommand) — but
    # only when there's a real feature name (not --help / --version).
    if argv and argv[0] not in {"capture", "list", "last", "scope-diff"} and not argv[0].startswith("-"):
        argv = ["capture", *argv]

    args = ap.parse_args(argv)
    if args.cmd is None or args.cmd == "capture":
        if not hasattr(args, "feature"):
            ap.error("feature name required")
        return cmd_capture(args)
    if args.cmd == "list":
        return cmd_list(args)
    if args.cmd == "last":
        return cmd_last(args)
    if args.cmd == "scope-diff":
        return cmd_scope_diff(args)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
