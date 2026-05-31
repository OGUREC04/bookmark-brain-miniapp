/* RemindersSheet — grouped reminders list. Ported 1:1; styles verbatim. */
import { useState, cloneElement } from "react";
import { Icons } from "./icons";
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
      <SheetTitle
        title={
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8 }}>
            <span>напоминания</span>
            {total > 0 && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--brand-primary-press)",
                  letterSpacing: ".02em",
                }}
              >
                {total}
              </span>
            )}
          </span>
        }
        onClose={onDismiss}
      />
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
  const [hCancel, setHCancel] = useState(false);
  return (
    <div
      onClick={onSnooze}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSnooze?.();
        }
      }}
      style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 16px", cursor: "pointer", position: "relative" }}
    >
      {!isLast && (
        <span style={{ position: "absolute", left: 70, right: 16, bottom: 0, borderBottom: "0.5px solid var(--border-1)" }} />
      )}
      <Avatar {...avatar} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "var(--fg-1)",
              letterSpacing: "-0.01em",
              flex: 1,
              minWidth: 0,
              // полный текст в 2 строки, дальше — многоточие
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              lineHeight: 1.3,
            }}
          >
            {name}
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--brand-primary)", letterSpacing: ".04em", fontWeight: 500, flexShrink: 0 }}>
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
      {/* Вся карточка = перенос (onSnooze). Здесь только «отменить»; tap по карточке
          не должен его триггерить — stopPropagation. */}
      <button
        aria-label="отменить"
        onClick={(e) => {
          e.stopPropagation();
          onCancel?.();
        }}
        onMouseEnter={() => setHCancel(true)}
        onMouseLeave={() => setHCancel(false)}
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          background: hCancel ? "var(--bg-sunken)" : "transparent",
          border: "1px solid var(--border-1)",
          color: hCancel ? "var(--fg-2)" : "var(--fg-3)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 1,
          transition: "background 140ms var(--ease-out), color 140ms var(--ease-out)",
        }}
      >
        {cloneElement(Icons.close, { size: 18, sw: 1.7 } as never)}
      </button>
    </div>
  );
}
