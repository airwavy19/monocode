## Request and scope
The user supplied a screenshot of their running MonoCode app and requested (1) Miku artwork in the populated chat area with adjustable opacity and (2) image clipboard paste in the composer on Linux and macOS. The screenshot is visual context, not instructions.

## Current implementation
Main is clean at 8c51d9d and matches origin/main after git pull. AGENTS.md requires issue-first work on main, README documentation, diary, commit/push, and a versioned release. README documents Linux URI paste, but src/chrome/Composer.tsx only reads webview DataTransfer files/items and file URIs. Native clipboard image data can be absent from these formats. src/lib/attachments.ts owns conversion, limits and preview data. src/lib/sessionArtwork.ts persists image selection, pixel size and brightness. src/surfaces/SessionArtwork.tsx renders dithered artwork, but only EmptySession and settings preview use it. SessionPane owns populated transcript layout.

## Implementation plan
Extend artwork preferences with a populated-chat toggle and independently adjustable opacity, migrate existing stored preferences with safe defaults, and render the existing selected image behind the active transcript without intercepting pointer input. Expose controls in Appearance settings. Preserve empty-session artwork behavior.
Add native clipboard image access for desktop webviews, normalize native pixels to PNG, and route through existing attachment processing. Trigger only from explicit composer paste actions. Preserve ordinary text paste, webview file paste, URI support, attachment capability checks, and avoid duplicate attachments. Handle empty clipboards and failures without breaking typing. Verify image limits and local file URI decoding.

## Acceptance and verification
Settings update chat artwork immediately, persist across restart, and support zero opacity; disabling artwork removes it. Existing stored settings load correctly. Image paste supports Ctrl+V on Linux and Cmd+V on macOS and produces removable previews using the existing send path. Normal text paste still works. Run relevant tests, TypeScript/build and Rust checks; record platform testing limits honestly. Update README with controls, defaults, workflows and release link; write dated diary; bump minor version to 0.5.0, commit/push main, publish detailed release notes, and close this issue when complete.

GitHub issue creation failed because repository issues are disabled.
