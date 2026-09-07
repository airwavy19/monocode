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
  it("defaults to pixelated and migrates legacy artwork to it", () => {
    const {
      pixelated: _pixelated,
      showInChat: _show,
      chatOpacity: _opacity,
      ...legacy
    } = DEFAULT_ARTWORK;
    expect(DEFAULT_ARTWORK.pixelated).toBe(true);
    expect(load(legacy).pixelated).toBe(true);
  });
  it("preserves the native-resolution opt-out", () => {
    expect(load({ ...DEFAULT_ARTWORK, pixelated: false })).toMatchObject({
      pixelated: false,
    });
  });
});
