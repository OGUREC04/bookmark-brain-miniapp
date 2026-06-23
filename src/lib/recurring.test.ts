import { describe, it, expect } from "vitest";
import { fmtRecurrence, canCreateRecurring } from "./recurring";

describe("fmtRecurrence", () => {
  it("HH:MM для показа", () => {
    expect(fmtRecurrence(10, 0)).toBe("каждый день в 10:00");
    expect(fmtRecurrence(9, 5)).toBe("каждый день в 09:05");
    expect(fmtRecurrence(0, 0)).toBe("каждый день в 00:00");
  });
});

describe("canCreateRecurring", () => {
  it("false при пустом тексте", () => {
    expect(canCreateRecurring("", 10, 0)).toBe(false);
    expect(canCreateRecurring("   ", 10, 0)).toBe(false);
  });
  it("true при тексте и валидном времени", () => {
    expect(canCreateRecurring("x", 10, 0)).toBe(true);
  });
  it("false при невалидном времени", () => {
    expect(canCreateRecurring("x", 24, 0)).toBe(false);
    expect(canCreateRecurring("x", 10, 60)).toBe(false);
    expect(canCreateRecurring("x", -1, 0)).toBe(false);
  });
  it("границы времени валидны (00:00 и 23:59)", () => {
    expect(canCreateRecurring("x", 0, 0)).toBe(true);
    expect(canCreateRecurring("x", 23, 59)).toBe(true);
  });
});
