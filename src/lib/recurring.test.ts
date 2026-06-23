import { describe, it, expect } from "vitest";
import { buildRecurringRaw, fmtRecurrence, canCreateRecurring } from "./recurring";

describe("buildRecurringRaw", () => {
  it("строит канонную строку для бэк-парсера", () => {
    expect(buildRecurringRaw("полить цветы", 10, 0)).toBe("полить цветы каждый день в 10:00");
  });
  it("триммит текст и паддит время", () => {
    expect(buildRecurringRaw("  таблетки  ", 9, 5)).toBe("таблетки каждый день в 09:05");
  });
});

describe("fmtRecurrence", () => {
  it("HH:MM для показа", () => {
    expect(fmtRecurrence(10, 0)).toBe("каждый день в 10:00");
    expect(fmtRecurrence(9, 5)).toBe("каждый день в 09:05");
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
});
