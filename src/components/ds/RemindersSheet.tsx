/* RemindersSheet — grouped reminders list. Ported 1:1; styles verbatim. */
import { useState, cloneElement } from "react";
import { Icons, ExtraIcons } from "./icons";
import { Avatar } from "./ChatRow";
import { BottomSheet, SheetTitle } from "./sheetPrimitives";

export interface ReminderRowData {
  id: string;
  avatar: React.ComponentProps<typeof Avatar>;
  name: string;
  time: string;
  preview: string;
}

export function RemindersSheet({
  groups,
  onDismiss,
  onSnooze,
  onCancel,
}: {
  groups: { label: string; rows: ReminderRowData[] }[];
  onDismiss?: () => void;
  onSnooze?: (id: string) => void;
  onCancel?: (id: string) => void;
}) {
  const total = groups.reduce((s, g) => s + g.rows.length, 0);
  return (
    <BottomSheet onDismiss={onDismiss}>
      <SheetTitle title="напоминания" right={total > 0 ? String(total) : undefined} onClose={onDismiss} />
      {groups.length === 0 && (
        <div
          style={{
            padding: "20px 20px 28px",
            textAlign: "center",
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: 14,
            color: "var(--fg-3)",
          }}
        >
          напоминаний пока нет
        </div>
      )}
      {groups.map((g) => (
        <div key={g.label} style={{ marginBottom: 10 }}>
          <div
            style={{
              padding: "0 20px 4px",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "var(--brand-primary-press)",
              fontWeight: 500,
            }}
          >
            {g.label}
          </div>
          <div>
            {g.rows.map((r, i) => (
              <ReminderRow
                key={r.id}
                {...r}
                isLast={i === g.rows.length - 1}
                onSnooze={() => onSnooze?.(r.id)}
                onCancel={() => onCancel?.(r.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </BottomSheet>
  );
}

function ReminderRow({
  avatar,
  name,
  time,
  preview,
  isLast,
  onSnooze,
  onCancel,
}: ReminderRowData & { isLast?: boolean; onSnooze?: () => void; onCancel?: () => void }) {
  const [hSnooze, setHSnooze] = useState(false);
  const [hCancel, setHCancel] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", cursor: "pointer", position: "relative" }}>
      {!isLast && (
        <span style={{ position: "absolute", left: 70, right: 16, bottom: 0, borderBottom: "0.5px solid var(--border-1)" }} />
      )}
      <Avatar {...avatar} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--fg-1)",
              letterSpacing: "-0.01em",
              flex: 1,
              minWidth: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--brand-primary)", letterSpacing: ".04em", fontWeight: 500 }}>
            {time}
          </span>
        </div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: 13,
            color: "var(--fg-2)",
            lineHeight: 1.35,
            marginTop: 1,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {preview}
        </div>
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <button
          aria-label="отложить"
          onClick={onSnooze}
          onMouseEnter={() => setHSnooze(true)}
          onMouseLeave={() => setHSnooze(false)}
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: hSnooze ? "var(--brand-primary-tint)" : "rgba(255,252,246,0.7)",
            border: "1px solid rgba(255,255,255,0.6)",
            color: hSnooze ? "var(--brand-primary-press)" : "var(--fg-3)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 140ms var(--ease-out), color 140ms var(--ease-out)",
          }}
        >
          {cloneElement(ExtraIcons.clock, { size: 14, sw: 1.6 } as never)}
        </button>
        <button
          aria-label="отменить"
          onClick={onCancel}
          onMouseEnter={() => setHCancel(true)}
          onMouseLeave={() => setHCancel(false)}
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: hCancel ? "var(--bg-sunken)" : "transparent",
            border: "1px solid transparent",
            color: hCancel ? "var(--fg-2)" : "var(--fg-4)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 140ms var(--ease-out), color 140ms var(--ease-out)",
          }}
        >
          {cloneElement(Icons.close, { size: 13, sw: 1.6 } as never)}
        </button>
      </div>
    </div>
  );
}
