#!/usr/bin/env python3
"""
memory.py — per-repo lesson memory for AI coding agents.

Pure-stdlib wrapper around `docs/lessons-learned.md` in the current repo.
Subcommands:

  memory.py recall "<query>"          # keyword search across lessons
  memory.py remember "<fact>"         # append a timestamped entry
  memory.py list                      # compact list of all entries
  memory.py promote "<substring>"     # suggest an AGENTS.md/forward.md bullet
                                      # for a recurring lesson

Storage: docs/lessons-learned.md (auto-created on first use).
Per-repo basis: lives in the repo you're in (CWD).
Free, offline, zero dependencies, zero API keys.

For richer semantic search across repositories, see forward.md "Session Memory":
- Local: pip install mem0ai + Ollama (free, local model)
- Hosted: mem0 cloud free Hobby tier (10K memories/month)

Usage from an AI agent at session start:
  cd /path/to/repo
  python3 memory.py list | head -30              # skim what we know
  python3 memory.py recall "tunnel timeout"       # targeted lookups

Usage at session end:
  python3 memory.py remember "Bumped TimeoutStartSec to 60s — cloudflared needs it"
  python3 memory.py remember "Port 5000 orphan crashes tunnels" --project accountabill
"""

from __future__ import annotations

import argparse
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

LESSONS_PATH = Path("docs/lessons-learned.md")
ENTRY_HEADER_RE = re.compile(r"^\[(\d{4}-\d{2}-\d{2})\]\s*\[([^\]]+)\]", re.MULTILINE)


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def ensure_file() -> Path:
    """Create docs/lessons-learned.md with a header if missing. Return its path."""
    if not LESSONS_PATH.parent.exists():
        LESSONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    if not LESSONS_PATH.exists():
        LESSONS_PATH.write_text(
            "# Lessons Learned\n\n"
            f"_Auto-created by `memory.py` on {now_iso()}._ "
            "Each entry is timestamped with project + symptom + cause + fix + prevention. "
            "Search with `memory.py recall \"<query>\"`.\n\n"
        )
    return LESSONS_PATH


def split_entries(text: str) -> list[str]:
    """Split lessons file into individual entry blocks. Skips the header prose."""
    lines = text.splitlines()
    body_start = 0
    for i, line in enumerate(lines):
        if line.startswith("[") and ENTRY_HEADER_RE.match(line):
            body_start = i
            break
    body = "\n".join(lines[body_start:])
    chunks = re.split(r"\n(?=\[\d{4}-\d{2}-\d{2}\])", body.strip())
    return [c.strip() for c in chunks if c.strip()]


def cmd_recall(args: argparse.Namespace) -> int:
    text = ensure_file().read_text()
    query = args.query.lower()
    matches = [b for b in split_entries(text) if query in b.lower()]
    if not matches:
        print(f"No lessons match: {args.query!r}")
        return 1
    print(f"\n--- {len(matches)} match(es) for {args.query!r} ---\n")
    for block in matches:
        # Compact view: header + first 'Fix:' or 'Prevention:' line
        header = block.splitlines()[0]
        first_action = next(
            (l for l in block.splitlines() if l.startswith("Fix:") or l.startswith("Prevention:")),
            None,
        )
        print(header)
        if first_action:
            print(f"  → {first_action}")
        print()
    if args.verbose:
        print("=== verbose dump ===")
        for block in matches:
            print(block)
            print("---")
    return 0


def cmd_remember(args: argparse.Namespace) -> int:
    path = ensure_file()
    project = args.project or Path.cwd().name
    block = (
        f"[{now_iso()}] [{project}]\n"
        f"Symptom: {args.symptom or '-'}\n"
        f"Root cause: {args.cause or '-'}\n"
        f"Fix: {args.fact}\n"
        f"Prevention: {args.prevention or '-'}\n"
    )
    with path.open("a", encoding="utf-8") as f:
        f.write("\n" + block)
    print(
        f"Remembered [{project}]: {args.fact[:80]}\n"
        f"  → run `memory.py promote` to wire into AGENTS.md / forward.md when recurring"
    )
    return 0


def cmd_list(_: argparse.Namespace) -> int:
    text = ensure_file().read_text()
    entries = split_entries(text)
    print(f"# {len(entries)} lesson(s) in {LESSONS_PATH}")
    by_project: dict[str, int] = {}
    for block in entries:
        m = ENTRY_HEADER_RE.match(block)
        if m:
            project = m.group(2)
            by_project[project] = by_project.get(project, 0) + 1
    if by_project:
        print("\nBy project:")
        for proj, n in sorted(by_project.items(), key=lambda x: -x[1]):
            print(f"  {n:>4}  {proj}")
    print("\nRecent (last 10):")
    for block in entries[-10:]:
        print(f"  - {block.splitlines()[0]}")
    return 0


def cmd_promote(args: argparse.Namespace) -> int:
    text = ensure_file().read_text()
    needle = args.substring.lower()
    for block in split_entries(text):
        if needle in block.lower():
            lines = block.splitlines()
            header = lines[0]
            fix = next((l[4:].strip() for l in lines if l.startswith("Fix:")), None)
            prevention = next((l[12:].strip() for l in lines if l.startswith("Prevention:")), None)
            summary = prevention or fix or header
            print("# Suggested forward.md / AGENTS.md addition:")
            print(f"# (paste into the relevant section, then commit per Conventional Commits in `forward.md`)\n")
            print(f"- {summary}\n")
            print(f"# Source lesson:\n# {header}")
            return 0
    print(f"No matching lesson for: {args.substring!r}")
    return 1


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="memory.py",
        description="Per-repo lesson memory for AI agents. Pure markdown, zero infra.",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    r = sub.add_parser("recall", help="search lessons by keyword")
    r.add_argument("query")
    r.add_argument("-v", "--verbose", action="store_true", help="dump full matching entries")
    r.set_defaults(func=cmd_recall)

    rm = sub.add_parser("remember", help="append a new timestamped lesson")
    rm.add_argument("fact", help="one-line description of the fix or lesson")
    rm.add_argument("--project", default=None, help="project tag (default: current dir name)")
    rm.add_argument("--symptom", default=None, help="what was observed")
    rm.add_argument("--cause", default=None, help="root cause")
    rm.add_argument("--prevention", default=None, help="the rule that prevents re-bite")
    rm.set_defaults(func=cmd_remember)

    ls = sub.add_parser("list", help="list lessons (compact)")
    ls.set_defaults(func=cmd_list)

    pr = sub.add_parser("promote", help="suggest a forward.md/AGENTS.md bullet for a lesson")
    pr.add_argument("substring", help="substring matching the lesson you want to promote")
    pr.set_defaults(func=cmd_promote)

    return p


def main() -> int:
    args = build_parser().parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
