import { describe, expect, it } from "vitest";
import { isNewCommand, NEW_COMMAND } from "./newSession";

describe("new session command", () => {
  it("matches a standalone /new command", () => {
    expect(isNewCommand("/new")).toBe(true);
    expect(isNewCommand("  /NEW\n")).toBe(true);
  });

  it("does not consume ordinary prompt text", () => {
    expect(isNewCommand("/new chat")).toBe(false);
    expect(isNewCommand("mention /new in docs")).toBe(false);
    expect(isNewCommand("/newer")).toBe(false);
  });

  it("exposes a builtin skill entry that the slash picker can render", () => {
    expect(NEW_COMMAND.kind).toBe("builtin");
    expect(NEW_COMMAND.name).toBe("new");
    expect(NEW_COMMAND.invocation).toBe("new");
    expect(NEW_COMMAND.scope).toBe("builtin");
    expect(NEW_COMMAND.description.length).toBeGreaterThan(0);
  });
});
