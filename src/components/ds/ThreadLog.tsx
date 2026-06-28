/* ThreadLog — лента дописок заметки чат-бабблами (Notes as Conversations).
   Контейнер: группировка по дням (DaySeparator) + рендер EntryBubble. Каждая дописка
   (EntryBubble) сама держит режим правки/удаления (F3c). Голос-дописка (статусы
   transcribing/failed) — F3d. */
import { Fragment } from "react";
import { DaySeparator } from "./ChatRow";
import { EntryBubble } from "./EntryBubble";
import type { Entry } from "../../lib/api";
import { formatDaySeparator } from "../../lib/formatters";
import { groupEntriesByDay } from "../../lib/thread";

export function ThreadLog({
  entries,
  onEdit,
  onDelete,
  onToast,
}: {
  entries: Entry[];
  /** F3c: сохранить правку дописки. undefined = правка/удаление выключены. */
  onEdit?: (id: string, body: string) => Promise<void>;
  /** F3c: удалить дописку. */
  onDelete?: (id: string) => Promise<void>;
  onToast?: (msg: string) => void;
}) {
  if (entries.length === 0) return null;
  const groups = groupEntriesByDay(entries);
  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
      {groups.map((g) => (
        <Fragment key={g.key}>
          <DaySeparator label={formatDaySeparator(g.entries[0].created_at)} />
          {g.entries.map((e) => (
            <EntryBubble key={e.id} entry={e} onEdit={onEdit} onDelete={onDelete} onToast={onToast} />
          ))}
        </Fragment>
      ))}
    </div>
  );
}
