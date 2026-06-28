import { describe, expect, it } from "vitest";
import type { Entry } from "./api";
import { groupEntriesByDay, mergeEntriesById } from "./thread";

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

describe("mergeEntriesById", () => {
  it("снапшот без локальных лишних → возвращает снапшот как есть", () => {
    const snap = [entry("a", "2026-06-25T12:00:00Z"), entry("b", "2026-06-25T13:00:00Z")];
    expect(mergeEntriesById(snap, [entry("a", "2026-06-25T12:00:00Z")])).toBe(snap);
  });

  it("локальная дописка не в снапшоте → добавлена в конец (защита от гонки загрузки)", () => {
    // Гонка F3d: лента уже была [a,b]; пока грузилась, дописали c → поздний снапшот [a,b]
    // не должен потерять c.
    const snap = [entry("a", "2026-06-25T12:00:00Z"), entry("b", "2026-06-25T13:00:00Z")];
    const prev = [...snap, entry("c", "2026-06-25T14:00:00Z")];
    expect(mergeEntriesById(snap, prev).map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("снапшот — источник правды для статуса (та же id берётся из снапшота)", () => {
    // Голос: prev держит 'transcribing', поллинг принёс 'done' с тем же id → берём done.
    const prev: Entry[] = [{ ...entry("v", "2026-06-25T12:00:00Z"), entry_ai_status: "transcribing" }];
    const snap: Entry[] = [{ ...entry("v", "2026-06-25T12:00:00Z"), body: "распознано", entry_ai_status: "done" }];
    const merged = mergeEntriesById(snap, prev);
    expect(merged).toHaveLength(1);
    expect(merged[0].entry_ai_status).toBe("done");
    expect(merged[0].body).toBe("распознано");
  });

  it("пустой prev → снапшот", () => {
    const snap = [entry("a", "2026-06-25T12:00:00Z")];
    expect(mergeEntriesById(snap, [])).toBe(snap);
  });
});
