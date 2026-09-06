import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  request: vi.fn(),
  resolveBinary: vi.fn(),
  spawnChild: vi.fn(),
  killChild: vi.fn(),
  frames: [] as Array<(record: Record<string, unknown>) => void>,
}));

vi.mock("./child", () => ({
  killChild: mocks.killChild,
  resolveOmpBinary: vi.fn(),
  resolvePiBinary: mocks.resolveBinary,
  spawnChild: mocks.spawnChild,
  unwatchChild: vi.fn(),
  watchChild: vi.fn(),
  writeChild: vi.fn(),
}));

vi.mock("./piClient", () => ({
  PiRpc: class {
    constructor(
      _sessionId: string,
      onFrame: (record: Record<string, unknown>) => void,
    ) {
      mocks.frames.push(onFrame);
    }

    request = mocks.request;
    close = mocks.close;
    pushLine = vi.fn();
  },
}));

import { compactPiContext, stopPiSession } from "./pi";
import type { HarnessEvent } from "./types";
import { appendUser, applyHarnessEvent } from "./apply";
import { newSession } from "../session";

describe("Pi live session", () => {
  beforeEach(() => {
    mocks.close.mockReset();
    mocks.request.mockReset();
    mocks.resolveBinary.mockReset();
    mocks.spawnChild.mockReset();
    mocks.killChild.mockReset();
    mocks.frames.length = 0;
    mocks.resolveBinary.mockResolvedValue({ path: "/fake/pi" });
    mocks.spawnChild.mockResolvedValue(undefined);
    mocks.killChild.mockResolvedValue(undefined);
    mocks.request.mockImplementation(
      async (command: Record<string, unknown>) => {
        if (command.type === "get_state") {
          return {
            data: {
              sessionId: "pi_session",
              model: { contextWindow: 200_000 },
            },
          };
        }
        if (command.type === "compact") {
          return { data: { estimatedTokensAfter: 32_000 } };
        }
        return { data: {} };
      },
    );
  });

  it("uses the compact RPC command and publishes the post-compact estimate", async () => {
    const events: HarnessEvent[] = [];

    await compactPiContext({
      sessionId: "pi-compact",
      cwd: "/repo",
      model: "pi:default",
      runtimeMode: "supervised",
      onEvent: (event) => events.push(event),
    });

    expect(mocks.request).toHaveBeenCalledWith(
      { type: "compact" },
      30 * 60_000,
    );
    expect(events).toContainEqual({
      type: "context",
      used: 32_000,
      window: 200_000,
    });
    await stopPiSession("pi-compact");
  });

  it("keeps footer status out of chat and publishes readable notifications", async () => {
    const events: HarnessEvent[] = [];
    await compactPiContext({
      sessionId: "pi-ansi",
      cwd: "/repo",
      model: "pi:default",
      runtimeMode: "supervised",
      onEvent: (event) => events.push(event),
    });
    const frame = mocks.frames[0]!;
    frame({
      type: "extension_ui_request",
      id: "ponytail-status",
      method: "setStatus",
      statusKey: "ponytail",
      statusText:
        "\u001b[38;5;241m○\u001b[39m \u001b[38;5;244mponytail:\u001b[39m \u001b[38;5;188m⚡ FULL\u001b[0m",
    });
    frame({
      type: "extension_ui_request",
      id: "plugin-notify",
      method: "notify",
      message: "\u001b[32mPlugin ready\u001b[0m",
    });
    frame({
      type: "extension_ui_request",
      id: "empty-status",
      method: "setStatus",
      statusText: "\u001b[0m",
    });
    expect(events.filter((event) => event.type === "status")).toEqual([
      { type: "status", text: "Plugin ready" },
    ]);
    await stopPiSession("pi-ansi");
  });

  it("does not split streamed responses with animated caveman footer updates", async () => {
    let session = appendUser(newSession("pi", "/repo"), "hello");
    await compactPiContext({
      sessionId: "pi-footer-stream",
      cwd: "/repo",
      model: "pi:default",
      runtimeMode: "supervised",
      onEvent: (event) => {
        session = applyHarnessEvent(session, event);
      },
    });
    const frame = mocks.frames[0]!;
    for (const kind of ["thinking", "text"]) {
      for (const [index, delta] of ["Hello", " there", "!"].entries()) {
        frame({
          type: "message_update",
          assistantMessageEvent: { type: `${kind}_delta`, delta },
        });
        frame({
          type: "extension_ui_request",
          id: `${kind}-footer-${index}`,
          method: "setStatus",
          statusKey: "caveman",
          statusText: `${["⠋", "⠙", "⠹"][index]} caveman level: FULL`,
        });
      }
    }
    frame({
      type: "extension_ui_request",
      id: "clear-footer",
      method: "setStatus",
      statusKey: "caveman",
    });
    expect(session.blocks.map(({ role, text }) => ({ role, text }))).toEqual([
      { role: "user", text: "hello" },
      { role: "reasoning", text: "Hello there!" },
      { role: "assistant", text: "Hello there!" },
    ]);
    await stopPiSession("pi-footer-stream");
  });
});
