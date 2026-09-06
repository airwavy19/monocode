rules:

1. **Create an Issue first based on prompt** and create it exhaustively detailed. Always commit and push to save changes, do everything on the `main` branch. Close the Issue when the work is fixed/done. Use the existing AGENTS.md + README.md + the related code as context for what to put in the issue body — the body should be detailed enough that a fresh agent could pick it up cold.
2. **Before starting any new work, run `git pull` to make sure the working tree is on the most up-to-date commit.** Working off a stale base causes merge conflicts and silently-missed prior work. Verify the pull landed cleanly with `git status` (clean) and `git log --oneline -1` (matches `origin/main`). If `git status` shows uncommitted changes, commit or revert them BEFORE pulling.
3. **Always update README.md exhaustively to keep the knowledge base up to date.** Every new feature, schema change, or operator-facing workflow should be reflected in README.md in the same commit (or in a follow-up commit if the README change is large).
4. **Cut a GitHub Release for every meaningful feature increase.** Each `feat:` / `fix:` cluster = release candidate. After merging to `main`:
   - Pick next SemVer tag: `feat:` → MINOR, `fix:` → PATCH, breaking → MAJOR. Align with Issue / commit body when present.
   - Write release notes as **first-class operator doc**, not a `git log` paste. Required sections: TL;DR (3 bullets), per-issue breakdown (problem + change + file list + verification), schema/API/UI diff (as relevant), operator workflow changes, new env vars/config (default + meaning), rollback steps, full diff link.
   - Use **verbatim `code` blocks** for all SQL, shell output, code snippets. No paraphrase.
   - **No marketing language.** Cut "seamlessly", "powerful", "excited", etc.
   - Every new env var / config key / port must appear with default + meaning.
   - Publish with `gh release create <tag> --title "vX.Y.Z — <slug>" --notes-file <file>`. Mark `prerelease` when cutting from `main` between stable releases.
   - Update `README.md` Releases/Changelog section in the **same commit** as the version bump. Tag and README link ship together.
   - **Never** skip a release because change feels small. One-line `fix:` on operator-facing path = PATCH bump + note.
   - Verify body non-trivial before publish: `gh release view <tag> --json body | jq '.body | length'`. If < 5 KB, write more.
5. Always write on the diary folder on root, the standard convention is `YYMMDD-HHMMAM/PM-<TOPIC>` (e.g. `250905-1139PM-topic`)
6. `forward_agents.py` syncs `forward.md` into `~/.pi/agent/AGENTS.md` (pi-coding-agent global context) by default, so the pi harness loads fresh rules every session start. Pass `--no-sync-pi-global` to opt out.