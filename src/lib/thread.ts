/* Группировка дописок заметки по дням для ленты (Notes as Conversations, F3a).
   Бэк отдаёт дописки по created_at (старое → новое); группируем подряд по локальному
   дню, порядок сохраняем (новое внизу, как в чате). Чистая логика — покрыта thread.test.ts. */
import type { Entry } from "./api";

export interface DayGroup {
  /** Ключ дня (локальный YYYY-MM-DD) — для React key и сравнения соседних. */
  key: string;
  entries: Entry[];
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Группы дописок по дням в хронологическом порядке (старый день → новый). */
export function groupEntriesByDay(entries: Entry[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const e of entries) {
    const key = dayKey(e.created_at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.entries.push(e);
    else groups.push({ key, entries: [e] });
  }
  return groups;
}
