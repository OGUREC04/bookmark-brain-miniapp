/* ThreadLog — лента дописок заметки чат-бабблами (Notes as Conversations, F3a).
   «Мои» дописки (kind=user) — пузырь справа; место под ответы Brain (kind brain/system)
   слева оставлено на будущее (в MVP Brain молчит). Дни — DaySeparator; время — formatTime.
   Read-only: правка/удаление — F3c, голос-дописка (статусы transcribing/failed) — F3d. */
import { Fragment } from "react";
import { Pulse } from "./atoms";
import { DaySeparator } from "./ChatRow";
import type { Entry } from "../../lib/api";
import { formatDaySeparator, formatTime } from "../../lib/formatters";
import { groupEntriesByDay } from "../../lib/thread";

function Bubble({ entry }: { entry: Entry }) {
  const mine = entry.kind === "user";
  const transcribing = entry.entry_ai_status === "transcribing";
  const failed = entry.entry_ai_status === "failed";

  return (
    <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", padding: "3px 0" }}>
      <div
        style={{
          maxWidth: "82%",
          background: mine ? "rgba(143,168,136,0.18)" : "var(--surface-glass-strong)",
          border: `0.5px solid ${mine ? "rgba(122,156,122,0.28)" : "var(--border-1)"}`,
          borderRadius: 16,
          borderBottomRightRadius: mine ? 5 : 16,
          borderBottomLeftRadius: mine ? 16 : 5,
          padding: "9px 13px 7px",
        }}
      >
        {transcribing ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 13.5, color: "var(--fg-3)" }}>
            <Pulse size={7} /> Распознаю голос…
          </span>
        ) : failed ? (
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 13.5, color: "var(--fg-3)" }}>
            🎙 Не удалось распознать
          </span>
        ) : (
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 14.5, color: "var(--fg-1)", lineHeight: 1.5, letterSpacing: "-0.005em", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {entry.body}
          </span>
        )}
        <span style={{ display: "block", textAlign: "right", marginTop: 4, fontFamily: "var(--font-ui)", fontSize: 10.5, color: "var(--fg-4)", letterSpacing: "-0.005em" }}>
          {entry.edited_at ? "изм. · " : ""}
          {formatTime(entry.created_at)}
        </span>
      </div>
    </div>
  );
}

export function ThreadLog({ entries }: { entries: Entry[] }) {
  if (entries.length === 0) return null;
  const groups = groupEntriesByDay(entries);
  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
      {groups.map((g) => (
        <Fragment key={g.key}>
          <DaySeparator label={formatDaySeparator(g.entries[0].created_at)} />
          {g.entries.map((e) => (
            <Bubble key={e.id} entry={e} />
          ))}
        </Fragment>
      ))}
    </div>
  );
}
