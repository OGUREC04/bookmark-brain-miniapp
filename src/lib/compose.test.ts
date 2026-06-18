import { describe, it, expect } from "vitest";
import { canSend, shouldExpandComposer, EXPAND_CHAR_THRESHOLD } from "./compose";

describe("canSend", () => {
  it("false when empty", () => {
    expect(canSend("", false)).toBe(false);
  });
  it("false when whitespace only", () => {
    expect(canSend("   \n  ", false)).toBe(false);
  });
  it("true when there is real text", () => {
    expect(canSend("привет", false)).toBe(true);
  });
  it("false while saving even with text", () => {
    expect(canSend("привет", true)).toBe(false);
  });
});

describe("shouldExpandComposer", () => {
  it("compact when empty", () => {
    expect(shouldExpandComposer("")).toBe(false);
  });
  it("compact for a short single line", () => {
    expect(shouldExpandComposer("короткая мысль")).toBe(false);
  });
  it("expands past the length threshold", () => {
    expect(shouldExpandComposer("a".repeat(EXPAND_CHAR_THRESHOLD + 1))).toBe(true);
  });
  it("expands on an explicit newline", () => {
    expect(shouldExpandComposer("строка\nещё")).toBe(true);
  });
  it("ignores leading/trailing whitespace for the length rule", () => {
    expect(shouldExpandComposer("  " + "a".repeat(5) + "   ")).toBe(false);
  });
});
