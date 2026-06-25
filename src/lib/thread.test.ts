import { describe, expect, it } from "vitest";
import type { Entry } from "./api";
import { groupEntriesByDay } from "./thread";

function entry(id: string, created_at: string): Entry {
  return { id, kind: "user", body: id, created_at, edited_at: null };
}

describe("groupEntriesByDay", () => {
  it("пустой список → нет групп", () => {
    expect(groupEntriesByDay([])).toEqual([]);
  });

  it("дописки одного дня → одна группа, порядок сохранён", () => {
    const g = groupEntriesByDay([
      entry("a", "2026-06-25T12:00:00Z"),
      entry("b", "2026-06-25T13:00:00Z"),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].entries.map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("дописки разных дней → группы в хронологическом порядке", () => {
    const g = groupEntriesByDay([
      entry("a", "2026-06-24T12:00:00Z"),
      entry("b", "2026-06-26T12:00:00Z"),
    ]);
    expect(g).toHaveLength(2);
    expect(g[0].entries[0].id).toBe("a");
    expect(g[1].entries[0].id).toBe("b");
  });

  it("несколько дописок в дне + смена дня → [[a,b],[c]]", () => {
    const g = groupEntriesByDay([
      entry("a", "2026-06-24T12:00:00Z"),
      entry("b", "2026-06-24T14:00:00Z"),
      entry("c", "2026-06-26T12:00:00Z"),
    ]);
    expect(g.map((x) => x.entries.map((e) => e.id))).toEqual([["a", "b"], ["c"]]);
  });
});
