
<p align="center">
  <img src="public/monocode.png" alt="MonoCode" width="88" />
</p>

<h1 align="center">MonoCode</h1>

<p align="center">
  <strong>A desktop UI for your coding agents.</strong>
</p>

<p align="center">
  <img width="1680" height="1050" alt="Screenshot 2026-09-04 at 06 34 00" src="https://github.com/user-attachments/assets/2cd4a6ec-eb1e-4b45-8627-a76442ea3874" />
</p>

Works with your subscriptions on Claude Code, Codex, Cursor, Grok Build, OpenCode, Pi, omp, and fx. If they’re installed and logged in, MonoCode can run them. Tabs are sessions. The composer is the input. MonoCode does not sell tokens.

## Install

> Install and log in to at least one provider first:
>
> - [Claude Code](https://claude.com/product/claude-code) - `claude auth login`
> - [Codex](https://developers.openai.com/codex/cli) - `codex login`
> - [Cursor CLI](https://cursor.com/cli) - `agent login`
> - [Grok Build](https://docs.x.ai/build/overview) - `curl -fsSL https://x.ai/cli/install.sh | bash` then `grok login`
> - [OpenCode](https://opencode.ai) - `opencode auth login`
> - [Pi](https://pi.dev/) - `npm install -g @earendil-works/pi-coding-agent`
> - [omp](https://omp.sh) - `curl -fsSL https://omp.sh/install | sh`
> - [fx](https://fx.sh) - `curl -fsSL https://fx.sh/setup.sh | bash` then `fx login`

macOS (Apple Silicon): download [MonoCode.dmg](https://dl.usemono.dev/MonoCode.dmg), open it, drag MonoCode to Applications.

Linux (x86_64): download the `.deb` or AppImage from [GitHub Releases](https://github.com/hardbeat920/monocode/releases/latest). Install the `.deb` with `sudo apt install ./MonoCode_*.deb`, or make the AppImage executable with `chmod +x MonoCode_*.AppImage` and run it directly.

Windows (x86_64): download the NSIS installer from [GitHub Releases](https://github.com/hardbeat920/monocode/releases/latest) and run it.

## Some notes

This is very early and you should expect bugs.

Small, focused pull requests are welcome. Anything large is worth an issue first - see [CONTRIBUTING.md](CONTRIBUTING.md).

### Show or hide agent thinking

Reasoning from Pi, Claude Code, Codex, OpenCode, and omp streams into the
transcript folded inside each turn's work. Toggle the **Show thinking** switch
in **Settings → General** to keep it visible or hide it entirely. The same
toggle is bound to `Ctrl/Cmd + Shift + T` anywhere in the app, so a running
turn can be flipped without losing your place.

### Artwork behind active chats

Open **Settings → Appearance → Session background**, choose **Image**, and
use **Artwork in chats** to keep Miku (or your selected local image) behind
conversation messages. **Chat opacity** ranges from 0–100%, defaults to 15%,
and updates immediately. The toggle defaults to on; setting opacity to 0%
hides the active-chat image. Arcade and None do not draw a chat image.
The image sits behind the transcript, does not intercept clicks or selection,
and stays fixed while messages scroll. Existing pixel-size controls apply to
both empty and populated sessions. **Brightness** still controls the empty
session and preview, independently of chat opacity; the artwork keeps its
vertical fade. Reset restores Miku and all artwork defaults.

Preferences remain local under `monocode.sessionArtwork`. New fields are
`showInChat` (default `true`, whether populated chats show the selected image)
and `chatOpacity` (default `15`, percent opacity, clamped to 0–100). Existing
preferences migrate without losing image selection, local path, brightness,
or pixel size. No database migration, environment variable or port is added.

#### High-definition background by default

The session background now renders at its **highest definition by default**:
container-resolution canvas, smooth bilinear scaling, no downsample, no Bayer
dither, `image-rendering: auto`. The bundled `Miku` wallpaper and any
local image (JPEG, PNG, WebP) fill the pane crisply out of the box.

Turn **Pixelated look** on under **Settings → Appearance → Session
background** to apply the dithered pixel-art treatment on top of the
high-definition render — Miku's chunky woven texture. The toggle is a
boolean on `monocode.sessionArtwork.pixelated` (default `false`). The
pixel-size slider only affects the pixelated path; the native path paints
at container resolution.

Legacy artwork preferences that match the previous default bundle
(bundled `Miku`, `pixelSize: 3`, `brightness: 65`, `showInChat: true`,
`chatOpacity: 15`, no custom `path`) migrate to `pixelated: false` on next
launch. Users who customised the image or explicitly toggled the
pixel-art treatment keep their saved choice.

### Paste images on Linux and macOS

Copy a screenshot or image, focus the chat composer, then press **Ctrl+V** on
Linux or **Cmd+V** on macOS. A removable image attachment appears above the
input; type any instructions and send as usual. Image understanding depends
on the selected provider/model supporting image input. Providers that do not
support attachments keep their existing restriction.

The composer first uses webview clipboard files/items and local `file://`
URIs. When the webview provides no image or no paste event, an explicit paste
shortcut can fall back to the native desktop clipboard. TIFF-only clipboard
images also use the native path to become PNG. Native clipboard pixels are
encoded to PNG and enter the existing attachment preview/send flow. Ordinary
text paste remains native to the input, and files take priority over redundant
URI payloads. Local URIs decode escaped filename characters; remote file URI
hosts are ignored. Both normal paste events and keyboard fallback are scoped
to the composer; no background clipboard polling is performed.

Native access uses arboard with X11 and Wayland data-control support on Linux
and native clipboard access on macOS. Wayland availability depends on the
compositor; arboard falls back to X11 if data-control is unavailable. If native
reading fails, the composer displays the error; use the attachment picker or
drag a saved image into the composer. Images above 80 MiB of decoded RGBA
pixels or 20 MiB of encoded PNG data are rejected by the native conversion.
The existing maximum is 20 attachments per message. Clipboard contents are
not changed or saved as an artwork preference.

### Releases / Changelog

- [v0.6.0 — high-definition background default](https://github.com/airwavy19/monocode/releases/tag/v0.6.0): session background now renders at container resolution with smooth scaling by default; **Pixelated look** toggle opts back into the dithered pixel-art treatment; legacy default-bundle artwork preferences migrate to `pixelated: false` on next launch. Also includes the v0.5.x follow-ups: pitch-black theme default, Notifications off-by-default with system banner + permission flow, and the **Pixelated look** toggle itself. This is a prerelease from main pending native desktop smoke testing. See [CHANGELOG.md](CHANGELOG.md) and the release notes for verification, migration behaviour and rollback instructions.
- [v0.5.0 — chat artwork and image paste](https://github.com/airwavy19/monocode/releases/tag/v0.5.0): adjustable artwork in populated chats; native image clipboard fallback for desktop composers; local URI decoding and full attachment-limit handling. This is a prerelease from main pending native desktop smoke testing. See [CHANGELOG.md](CHANGELOG.md) and the release notes for verification, platform limits and rollback instructions. Installing a rebuilt desktop application is required for the new native clipboard command; refreshing an old binary's frontend is insufficient.

### Start a fresh chat with `/new`

Type `/new` in the composer (or pick it from the `/` picker) to spin up a
new tab in the same project. The new composer is focused immediately so the
old transcript stays behind without any sidebar hunting.

### Time-ago labels on the git graph

Each commit row in the source-control graph now shows a compact `5m` /
`3h` / `2d` / `3w` / `5mo` / `2y` pill next to the ref tag. Hover the
pill for the full verbose relative time. The label re-renders every minute
so a long-running session doesn't leave stale dates behind.

## Build from source

Supports macOS, Linux, and Windows.

Need Node.js 20+ and a current stable Rust toolchain. On Linux, ensure standard Tauri prerequisites are installed (e.g. `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libsoup-3.0-dev`, `libjavascriptcoregtk-4.1-dev`). On Windows, the installer bootstraps the [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) runtime when it is missing.

```bash
npm install
npm run tauri dev
```

### Ubuntu / Debian packages

On an Ubuntu/Debian workstation, the repository can install the native Tauri prerequisites and build distributable Linux packages directly:

```bash
npm run setup:linux:deb
npm ci
npm run build:linux
```

The Linux build emits `.deb` and AppImage bundles under `target/release/bundle/`.
Tauri loads `src-tauri/tauri.linux.conf.json` automatically for Linux development and builds.

### Windows packages

```bash
npm ci
npm run build:windows
```

The Windows build emits an NSIS installer under `target/release/bundle/nsis/`.
Tauri loads `src-tauri/tauri.windows.conf.json` automatically for Windows development and builds.

## License

[MIT](LICENSE). Provider names and logos are trademarks of their owners - see [NOTICE](NOTICE).
