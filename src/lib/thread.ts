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

/** Слить серверный снапшот ленты с локальными дописками, которых в нём ещё нет
   (добавлены оптимистично, пока GET /thread был в полёте). По id: снапшот — источник
   правды (правки/статусы записей), локальные «лишние» добавляем в конец (они новейшие).
   Без этого поздний ответ первичной загрузки/поллинга затирал бы полной заменой только
   что добавленную дописку — потеря данных (находка ревью F3d). Иммутабельно. */
export function mergeEntriesById(snapshot: Entry[], prev: Entry[]): Entry[] {
  const ids = new Set(snapshot.map((e) => e.id));
  const localExtra = prev.filter((e) => !ids.has(e.id));
  return localExtra.length > 0 ? [...snapshot, ...localExtra] : snapshot;
}

/** Поллинг статуса голос-дописки: обновить в ленте ТОЛЬКО записи со статусом
   'transcribing' их свежей версией из снапшота (распозналось → текст/done, или failed).
   Остальные записи НЕ трогаем — правки/удаления локальны и авторитетны; иначе стейл-снапшот
   поллинга (GET вылетел до коммита PATCH/DELETE) откатил бы правку или воскресил удалённую
   запись (находки ревью F3c). Возвращает prev без изменений, если обновлять нечего. */
export function applyTranscriptionUpdates(prev: Entry[], snapshot: Entry[]): Entry[] {
  let changed = false;
  const next = prev.map((e) => {
    if (e.entry_ai_status !== "transcribing") return e;
    const fresh = snapshot.find((s) => s.id === e.id);
    if (fresh && (fresh.entry_ai_status !== e.entry_ai_status || fresh.body !== e.body)) {
      changed = true;
      return fresh;
    }
    return e;
  });
  return changed ? next : prev;
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
