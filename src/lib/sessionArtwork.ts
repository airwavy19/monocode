import { open } from "@tauri-apps/plugin-dialog";
import { readBinaryFile } from "./fs";
import { useSyncExternalStore } from "react";

export type SessionArtwork = {
  mode: "image" | "arcade" | "none";
  source: string;
  path?: string;
  name: string;
  pixelSize: number;
  pixelated: boolean;
  brightness: number;
  showInChat: boolean;
  chatOpacity: number;
};
const KEY = "monocode.sessionArtwork";
const EVENT = "monocode:session-artwork";
// Highest-definition render by default: container-resolution canvas with
// smooth scaling and no dithering. The pixel-art treatment is an explicit
// opt-in via the Settings → Appearance → Pixelated look toggle.
export const DEFAULT_ARTWORK: SessionArtwork = {
  mode: "image",
  source: "/wallpapers/miku.jpg",
  name: "Miku",
  pixelSize: 3,
  pixelated: false,
  brightness: 65,
  showInChat: true,
  chatOpacity: 15,
};
// Snapshot of the previous default bundle (before the high-definition flip)
// so the loader can detect users who never customised their background and
// migrate them to the new default without clobbering anyone who opted in.
const LEGACY_DEFAULT_ARTWORK: SessionArtwork = {
  mode: "image",
  source: "/wallpapers/miku.jpg",
  name: "Miku",
  pixelSize: 3,
  pixelated: true,
  brightness: 65,
  showInChat: true,
  chatOpacity: 15,
};
function matchesLegacyDefault(
  normalized: Omit<SessionArtwork, "pixelated">,
): boolean {
  return (
    normalized.mode === LEGACY_DEFAULT_ARTWORK.mode &&
    normalized.source === LEGACY_DEFAULT_ARTWORK.source &&
    normalized.path === undefined &&
    normalized.name === LEGACY_DEFAULT_ARTWORK.name &&
    normalized.pixelSize === LEGACY_DEFAULT_ARTWORK.pixelSize &&
    normalized.brightness === LEGACY_DEFAULT_ARTWORK.brightness &&
    normalized.showInChat === LEGACY_DEFAULT_ARTWORK.showInChat &&
    normalized.chatOpacity === LEGACY_DEFAULT_ARTWORK.chatOpacity
  );
}
let cachedRaw: string | null | undefined;
let cached = DEFAULT_ARTWORK;
export function loadSessionArtwork(): SessionArtwork {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === cachedRaw) return cached;
    cachedRaw = raw;
    const value = raw ? JSON.parse(raw) : null;
    const showInChat =
      typeof value.showInChat === "boolean" ? value.showInChat : true;
    const chatOpacity = Number.isFinite(value.chatOpacity)
      ? Math.max(0, Math.min(100, value.chatOpacity))
      : 15;
    const pixelSize = Math.max(1, Math.min(6, value.pixelSize));
    const brightness = Math.max(20, Math.min(100, value.brightness));
    const pixelatedRaw = typeof value.pixelated === "boolean";
    const pixelated = pixelatedRaw
      ? matchesLegacyDefault({
          ...value,
          showInChat,
          chatOpacity,
          pixelSize,
          brightness,
        })
        ? false
        : value.pixelated
      : false;
    cached =
      value &&
      ["image", "arcade", "none"].includes(value.mode) &&
      typeof value.source === "string" &&
      (value.source === DEFAULT_ARTWORK.source ||
        /^data:image\/jpeg;base64,/.test(value.source)) &&
      (value.path === undefined || typeof value.path === "string") &&
      typeof value.name === "string" &&
      Number.isFinite(value.pixelSize) &&
      Number.isFinite(value.brightness)
        ? {
            ...value,
            showInChat,
            chatOpacity,
            pixelSize,
            pixelated,
            brightness,
          }
        : DEFAULT_ARTWORK;
  } catch {
    cached = DEFAULT_ARTWORK;
  }
  return cached;
}
export function saveSessionArtwork(value: SessionArtwork) {
  // Let the picker report storage failures instead of pretending the image saved.
  localStorage.setItem(KEY, JSON.stringify(value));
  window.dispatchEvent(new Event(EVENT));
}
function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
export function useSessionArtwork() {
  return useSyncExternalStore(
    subscribe,
    loadSessionArtwork,
    () => DEFAULT_ARTWORK,
  );
}

/** Read local artwork without copying it into preferences or uploading it. */
export async function localArtworkUrl(path: string): Promise<string> {
  const bytes = await readBinaryFile(path);
  const extension = path.split(".").pop()?.toLowerCase();
  const type =
    extension === "png"
      ? "image/png"
      : extension === "webp"
        ? "image/webp"
        : "image/jpeg";
  return URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type }));
}

export async function selectSessionArtwork(
  currentPath?: string,
): Promise<string | null> {
  const path = await open({
    title: "Choose a session background",
    multiple: false,
    directory: false,
    defaultPath: currentPath,
    filters: [{ name: "Images", extensions: ["jpg", "jpeg", "png", "webp"] }],
  });
  if (typeof path !== "string") return null;
  const url = await localArtworkUrl(path);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
  } finally {
    URL.revokeObjectURL(url);
  }
  return path;
}
