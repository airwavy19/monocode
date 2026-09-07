import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ARTWORK, loadSessionArtwork } from "./sessionArtwork";
afterEach(() => vi.unstubAllGlobals());
function load(value: unknown) {
  vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(value) });
  return loadSessionArtwork();
}
describe("session artwork preferences", () => {
  it("migrates existing artwork without losing the image or brightness", () => {
    const {
      showInChat: _show,
      chatOpacity: _opacity,
      ...legacy
    } = DEFAULT_ARTWORK;
    expect(load({ ...legacy, brightness: 48 })).toMatchObject({
      brightness: 48,
      showInChat: true,
      chatOpacity: 15,
    });
  });
  it("preserves hidden artwork and clamps opacity", () => {
    expect(
      load({ ...DEFAULT_ARTWORK, showInChat: false, chatOpacity: 0 }),
    ).toMatchObject({ showInChat: false, chatOpacity: 0 });
    expect(load({ ...DEFAULT_ARTWORK, chatOpacity: 150 }).chatOpacity).toBe(
      100,
    );
    expect(load({ ...DEFAULT_ARTWORK, chatOpacity: -1 }).chatOpacity).toBe(0);
  });
  it("recovers invalid optional preferences", () => {
    expect(
      load({ ...DEFAULT_ARTWORK, showInChat: "yes", chatOpacity: "bad" }),
    ).toMatchObject({ showInChat: true, chatOpacity: 15 });
  });
  it("defaults to high definition and migrates legacy artwork to it", () => {
    const {
      pixelated: _pixelated,
      showInChat: _show,
      chatOpacity: _opacity,
      ...legacy
    } = DEFAULT_ARTWORK;
    expect(DEFAULT_ARTWORK.pixelated).toBe(false);
    expect(load(legacy).pixelated).toBe(false);
  });
  it("migrates a legacy default-bundle save to high definition", () => {
    const {
      showInChat: _show,
      chatOpacity: _opacity,
      ...legacyBundle
    } = DEFAULT_ARTWORK;
    expect(
      load({
        ...legacyBundle,
        mode: "image",
        source: "/wallpapers/miku.jpg",
        name: "Miku",
        pixelSize: 3,
        pixelated: true,
        brightness: 65,
      }),
    ).toMatchObject({ pixelated: false });
  });
  it("preserves the pixel-art opt-in for a customised image", () => {
    expect(
      load({
        ...DEFAULT_ARTWORK,
        path: "/Users/me/Pictures/wallpaper.jpg",
        name: "wallpaper.jpg",
        pixelated: true,
      }),
    ).toMatchObject({ pixelated: true });
  });
});
