/* RemindersSheet — grouped reminders list. Ported 1:1; styles verbatim. */
import { cloneElement } from "react";
import { Icons } from "./icons";
import { Avatar } from "./ChatRow";
import { BottomSheet, SheetTitle } from "./sheetPrimitives";

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export interface ReminderRowData {
  id: string;
  avatar: React.ComponentProps<typeof Avatar>;
  name: string;
  time: string;
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
    <BottomSheet onDismiss={onDismiss} minHeight={340} paddingBottom={34}>
      <SheetTitle
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span>Напоминания</span>
            {total > 0 && (
              <span
                style={{
                  minWidth: 20,
                  height: 20,
                  padding: "0 6px",
                  borderRadius: 999,
                  background: "var(--brand-primary)",
                  color: "var(--fg-on-brand)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  letterSpacing: 0,
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
          Напоминаний пока нет
        </div>
      )}
      {groups.map((g) => (
        <div key={g.label} style={{ marginBottom: 10 }}>
          <div
            style={{
              padding: "0 20px 6px",
              fontFamily: "var(--font-ui)",
              fontSize: 12.5,
              letterSpacing: "-0.005em",
              color: "var(--brand-primary-press)",
              fontWeight: 600,
            }}
          >
            {cap(g.label)}
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
  isLast,
  onSnooze,
  onCancel,
}: ReminderRowData & { isLast?: boolean; onSnooze?: () => void; onCancel?: () => void }) {
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
        {/* время — НАД текстом, акцентом */}
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--brand-primary)", letterSpacing: ".04em", fontWeight: 600, marginBottom: 2 }}>
          {time}
        </div>
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: "var(--fg-1)",
            letterSpacing: "-0.01em",
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
      </div>
      {/* Вся карточка = перенос (onSnooze); × отменяет пункт (stopPropagation, без дубля). */}
      <button
        type="button"
        aria-label="отменить"
        onClick={(e) => {
          e.stopPropagation();
          onCancel?.();
        }}
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          marginTop: 1,
          borderRadius: "50%",
          border: "none",
          background: "transparent",
          color: "var(--fg-4)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {cloneElement(Icons.close, { size: 17, sw: 1.7 } as never)}
      </button>
    </div>
  );
}
