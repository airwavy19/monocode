## TL;DR

- Miku and locally selected artwork can remain behind populated conversations. Settings → Appearance → Session background now includes an Artwork in chats toggle and a separate Chat opacity slider, defaulting to 15%.
- Explicit image paste in the composer has a native desktop fallback for Linux and macOS. Native image pixels become PNG attachments when the webview supplies no usable image payload, including TIFF-only clipboard presentations.
- This is a main-branch prerelease. Automated web and Rust verification is recorded below; live desktop clipboard verification on Linux/macOS remains a release qualification step. Rebuild or install the desktop binary to obtain the new native command.

## Request breakdown: artwork in populated chats

### Problem

The user's running MonoCode screenshot showed a populated chat with a plain background. Miku was selectable as new-session artwork, but the image was rendered only by EmptySession and the settings preview. Once the conversation contained messages, that component was replaced by AgentTranscript, so selecting an image did not affect the populated pane. The existing brightness preference therefore could not provide the requested control over an active conversation's background.

### Change

SessionPane now subscribes to the existing artwork preference store. A populated conversation in Image mode renders the same SessionArtwork component behind its transcript when Artwork in chats is enabled and Chat opacity is greater than zero. A stacking context confines the layer to the transcript pane. The artwork layer ignores pointer events, so text selection, transcript controls, scrolling, and composer interaction retain their ordinary targets. The existing dithered image renderer and vertical fade are reused.

The new opacity affects the artwork layer rather than the message content. The empty-session Brightness value remains independent. Switching to Arcade or None removes the populated-chat image. The selected image path, source, name, and pixel size continue to come from the same preference object. Reset restores the original Miku asset and default values, including the new fields.

### Files

- src/lib/sessionArtwork.ts: persisted preference fields, defaults, legacy migration, and clamping.
- src/surfaces/SessionPane.tsx: populated-chat artwork layer and preference subscription.
- src/surfaces/SettingsView.tsx: Session background heading, Artwork in chats toggle, and Chat opacity control.
- src/lib/sessionArtwork.test.ts: legacy preferences, zero opacity, disabled state, clamping, and invalid optional values.

### Verification

The preference tests verify that legacy values retain brightness while receiving the new defaults, disabled artwork remains disabled, zero is retained rather than treated as missing, out-of-range values are clamped, and malformed optional values fall back safely. TypeScript and the production web build validate the integration. A browser-only preview was attempted but the existing application requires Tauri window/webview metadata and cannot mount normally in a plain browser; that attempt is not claimed as successful visual verification.

## Request breakdown: image clipboard paste

### Problem

Composer already accepted files/items exposed by the webview and local file URI payloads. Native screenshots can instead remain in the operating system clipboard without a File object, and some webviews omit the paste event entirely for those images. macOS may expose TIFF, which is not a standard vision input format in the existing attachment pipeline. The previous URI decoder also left escaped reserved filename characters encoded, and adding to a full attachment list could exceed its declared maximum by one.

### Change

A new asynchronous Tauri command reads a native clipboard image on a blocking worker and encodes its RGBA pixels as PNG. arboard supplies desktop clipboard access with its Wayland data-control feature enabled, alongside X11 support on Linux and native macOS support. The frontend invokes this only during composer paste handling or a paste keyboard shortcut whose webview event does not arrive. It does not continuously monitor the clipboard.

The normal paste handler retains the webview file path as its first choice. Files take priority over URI payloads to avoid attaching a second representation of the same clipboard item. When only text is present, ordinary text insertion continues. TIFF-only clipboard presentations use native conversion. A pending-operation guard prevents concurrent native reads from repeated shortcuts. Conversion errors are displayed near the composer, and empty native image content returns no attachment.

Local file URIs are parsed as URLs. Only an empty hostname or localhost is accepted, and the pathname is fully percent-decoded so filenames containing spaces, hash signs, and question marks resolve correctly. An existing full attachment list stays at 20 items when another paste is attempted.

### Files

- src-tauri/src/clipboard.rs: native read, PNG encoding, limits, and encoder validation test.
- src-tauri/src/lib.rs: command registration.
- src-tauri/Cargo.toml and Cargo.lock: arboard and PNG dependencies and their resolved dependency graph.
- src/lib/attachments.ts: native PNG bridge, local URI parsing, and full-list limit correction.
- src/chrome/Composer.tsx: paste event and keyboard fallback routing, duplicate avoidance, and visible errors.
- src/lib/attachments.test.ts: decoded local filenames, remote host rejection, and the already-full attachment case.

### Verification and limits

The Rust encoder test checks the PNG signature and rejects empty, inconsistent, and overflowing dimensions. Clipboard reading itself requires an interactive desktop with a clipboard owner and has not been verified across actual macOS, X11, and Wayland sessions in this run. On Wayland, data-control support depends on the compositor; arboard can fall back to X11 when that protocol is unavailable. A compositor without either usable path may still require the existing webview paste or file picker. No claim is made that every image editor's clipboard format is supported.

## Schema, API, and UI diff

No SQL schema or session storage migration is introduced. Two optional-on-read fields are added to the existing localStorage object under monocode.sessionArtwork:

| Key | Default | Meaning |
| --- | --- | --- |
| showInChat | true | Display selected image artwork behind populated chats while mode is image. |
| chatOpacity | 15 | Artwork-layer opacity as a percentage, constrained to 0–100. Zero hides the layer. |

Legacy objects receive those defaults without resetting the selected image or the original image controls. The native read_clipboard_image command takes no arguments and returns a nullable base64 PNG string or a descriptive error. It introduces no external HTTP API, listener, database table, or port.

## Operator workflow changes

1. Install a desktop build from this revision. A frontend refresh against an older binary cannot provide the new Tauri command.
2. Open Settings → Appearance → Session background and select Image. Keep Miku, choose a local image, or reset to the bundled default.
3. Enable Artwork in chats and adjust Chat opacity while looking at an existing conversation. Confirm text remains readable at the chosen opacity. Set the value to zero or turn off the toggle to hide it.
4. Copy an image from an image editor or screenshot tool and focus the composer. Use Ctrl+V on Linux or Cmd+V on macOS. Confirm the preview, optionally type instructions, then send to an image-capable provider/model.
5. If native clipboard access reports an error, save the screenshot and attach it using the existing picker or drag/drop. This is also the fallback when a compositor or image source offers an unsupported format.

Native conversion rejects more than 80 MiB of decoded RGBA pixels and more than 20 MiB of encoded PNG data. These are fixed limits, not new configurable values. The existing maximum of 20 attachments per message remains in effect. Actual image understanding still depends on the provider and selected model. Copying an image does not send it; sending remains a separate composer action.

## Environment and configuration

No new environment variables, configuration files, or ports are required. Existing development and release configuration remains in place. The two local preference fields and their defaults are listed above. arboard and png are compiled dependencies; no additional clipboard CLI must be installed. Existing Tauri Linux build prerequisites still apply. The native operation reads clipboard data and never replaces clipboard contents.

## Rollback

Disable Artwork in chats to remove the visible change without replacing the application. If a native clipboard regression blocks work, use the picker while rolling back to the previously installed desktop build. Existing session data and original artwork fields remain compatible; older code ignores the added preference fields.

To inspect or build the previous code without resetting the main checkout or deleting local data:

```bash
git worktree add --detach ../monocode-v0.4.0 v0.4.0
cd ../monocode-v0.4.0
npm ci
npm run build
```

Build or install the appropriate older desktop package using the project's existing platform instructions. Do not delete the application data directory as a rollback step. The prior release tag predates the latest untagged artwork commit; restoring that tag therefore also removes that earlier main-only artwork implementation.

## Repository bookkeeping

GitHub Issues are disabled for this repository. The requested issue creation was attempted and rejected, so the exhaustive request, implementation plan, and acceptance criteria are preserved as issue.md in the dated diary folder. There is no GitHub issue number to close. README, CHANGELOG, the package manifests and lockfiles, Tauri version, and diary ship with version 0.5.0 on main. This release is marked prerelease pending desktop smoke testing.

## Full diff

[Compare v0.4.0 to v0.5.0](https://github.com/airwavy19/monocode/compare/v0.4.0...v0.5.0)

## Automated verification results

All commands below completed successfully on the Linux development host. The production build reported its existing large-chunk advisory; it did not fail. No live macOS clipboard test or native desktop visual smoke test is claimed.

```bash
npm run check:web
npm run build
cargo check -p monocode
cargo fmt --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test
git diff --check
```

Selected verbatim result lines:

```text
 Test Files  126 passed (126)
      Tests  1303 passed (1303)
test result: ok. 201 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.22s
✓ built in 20.93s
```
