# Chat artwork and native image paste — v0.5.0

Request: retain Miku/selected artwork in populated chats with adjustable opacity; paste images in the composer on Linux/macOS. Screenshot treated as visual context only.

Started from clean main 8c51d9d, git pull clean and origin/main matched. GitHub Issues disabled; issue creation attempt failed, detailed issue preserved in issue.md. No GitHub issue exists to close. Local request status: implementation complete; native desktop smoke testing remains pending.

Implemented shared artwork preference migration, chat toggle and 0–100% opacity (15% default), transcript layer, native clipboard read/PNG encoding with arboard, TIFF fallback, paste error display, local URI decoding, redundant file/URI avoidance, and 20-attachment limit correction. Version bumped to 0.5.0 across manifests/lockfiles. README and CHANGELOG updated; release-notes.md contains operator documentation and rollback guidance.

Verification: 126 web test files, 1303 tests passed; TypeScript passed; production web build passed (existing chunk-size advisory). cargo check, cargo fmt --check, Clippy with -D warnings, and cargo test passed (201 Rust tests). git diff --check passed. Plain browser preview cannot mount because existing desktop code requires Tauri metadata; no successful native visual test or real macOS clipboard test claimed. Publish as prerelease pending native Linux/macOS smoke checks.

Native smoke checklist: toggle chat artwork and vary opacity through 0/15/100; switch Image/Arcade/None; reload preferences; scroll and select transcript text; paste screenshot via Ctrl+V on Linux and Cmd+V on macOS; check one removable preview and image-capable send; ordinary text/URI paste; empty clipboard, TIFF, unsupported compositor, full attachment list. Rebuild the desktop binary for the added native command.
