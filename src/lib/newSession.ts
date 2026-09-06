import type { BuiltinSkill } from "./skills";

export const NEW_COMMAND: BuiltinSkill = {
  kind: "builtin",
  name: "new",
  invocation: "new",
  description: "Start a fresh chat in the same project. Keeps the workspace, drops the history.",
  scope: "builtin",
  source: "monocode",
};

/** Match the standalone composer command without consuming ordinary prompt text. */
export function isNewCommand(text: string): boolean {
  return /^\s*\/new\s*$/i.test(text);
}
