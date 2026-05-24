/* ReminderPickerSheet — quick slot pills + произвольная дата/время (DS-календарь). */
import { useState, cloneElement } from "react";
import { Icons, ExtraIcons } from "./icons";
import { Glyph } from "./atoms";
import { BottomSheet, SheetTitle, TelegramMainButton } from "./sheetPrimitives";
import { Calendar } from "./Calendar";
import { TimeWheel } from "./TimeWheel";

const SLOTS = [
  { id: "tonight", label: "сегодня вечером", sub: "в 18:00", hours: 0, at: [18, 0] },
  { id: "morning", label: "завтра утром", sub: "в 9:00", hours: 24, at: [9, 0] },
  { id: "weekend", label: "на выходные", sub: "сб, 10:00", hours: -1, at: [10, 0] },
  { id: "week", label: "через неделю", sub: "пт, 9:00", hours: 168, at: [9, 0] },
] as const;

function customToISO(dateISO: string, h: number, m: number): string {
  const [y, mo, d] = dateISO.split("-").map(Number);
  return new Date(y, mo - 1, d, h, m, 0, 0).toISOString();
}

const CUSTOM = "custom";

function slotToISO(id: string): string {
  const now = new Date();
  const d = new Date(now);
  if (id === "tonight") {
    d.setHours(18, 0, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
  } else if (id === "morning") {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
  } else if (id === "weekend") {
    const day = d.getDay();
    const toSat = (6 - day + 7) % 7 || 7;
    d.setDate(d.getDate() + toSat);
    d.setHours(10, 0, 0, 0);
  } else {
    d.setDate(d.getDate() + 7);
    d.setHours(9, 0, 0, 0);
  }
  return d.toISOString();
}

export function ReminderPickerSheet({
  contextText,
  onDismiss,
  onConfirm,
}: {
  contextText: string;
  onDismiss?: () => void;
  onConfirm?: (fireAtISO: string) => void;
}) {
  const [picked, setPicked] = useState<string>("tonight");
  const [date, setDate] = useState<string | null>(null);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);

  const customReady = picked !== CUSTOM || date !== null;
  const confirm = () => {
    if (picked === CUSTOM) {
      if (date) onConfirm?.(customToISO(date, hour, minute));
    } else {
      onConfirm?.(slotToISO(picked));
    }
  };
  return (
    <BottomSheet onDismiss={onDismiss}>
      <SheetTitle title="напомнить" onClose={onDismiss} />
      <div
        style={{
          margin: "0 16px 10px",
          padding: "10px 14px",
          background: "rgba(234,227,207,0.45)",
          border: "1px solid var(--border-1)",
          borderRadius: 14,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Glyph ch="✦" size={20} />
        <span
          style={{
            flex: 1,
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: 13.5,
            color: "var(--fg-2)",
            lineHeight: 1.35,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          «{contextText}»
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 16px" }}>
        {SLOTS.map((s) => {
          const on = picked === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setPicked(s.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "13px 16px",
                background: on ? "var(--brand-primary-tint)" : "rgba(255,252,246,0.7)",
                border: on ? "1px solid rgba(122,156,122,0.45)" : "1px solid rgba(255,255,255,0.6)",
                borderRadius: 14,
                cursor: "pointer",
                textAlign: "left",
                color: "var(--fg-1)",
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: on ? "none" : "1.5px solid var(--border-strong)",
                  background: on ? "var(--brand-primary)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--fg-on-brand)",
                  flexShrink: 0,
                }}
              >
                {on && cloneElement(Icons.check, { size: 11, sw: 2.5 } as never)}
              </span>
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500, letterSpacing: "-0.01em" }}>{s.label}</span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: on ? "var(--brand-primary-press)" : "var(--fg-3)",
                  letterSpacing: ".04em",
                }}
              >
                {s.sub}
              </span>
            </button>
          );
        })}

        {/* Произвольная дата/время */}
        <button
          onClick={() => setPicked(CUSTOM)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "13px 16px",
            background: picked === CUSTOM ? "var(--brand-primary-tint)" : "rgba(255,252,246,0.7)",
            border: picked === CUSTOM ? "1px solid rgba(122,156,122,0.45)" : "1px solid rgba(255,255,255,0.6)",
            borderRadius: 14,
            cursor: "pointer",
            textAlign: "left",
            color: "var(--fg-1)",
          }}
        >
          <span
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              border: picked === CUSTOM ? "none" : "1.5px solid var(--border-strong)",
              background: picked === CUSTOM ? "var(--brand-primary)" : "transparent",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--fg-on-brand)",
              flexShrink: 0,
            }}
          >
            {picked === CUSTOM && cloneElement(Icons.check, { size: 11, sw: 2.5 } as never)}
          </span>
          <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500, letterSpacing: "-0.01em" }}>выбрать дату и время</span>
          {cloneElement(ExtraIcons.calendar, { size: 16, sw: 1.6, style: { color: "var(--fg-3)" } } as never)}
        </button>
      </div>

      {/* DS-календарь + время — раскрывается при выборе «своя дата». */}
      {picked === CUSTOM && (
        <div style={{ padding: "12px 16px 0" }}>
          <Calendar value={date} onSelect={setDate} />
          <div style={{ marginTop: 8, borderTop: "1px solid var(--border-1)", paddingTop: 4 }}>
            <TimeWheel hour={hour} minute={minute} onChange={(h, m) => { setHour(h); setMinute(m); }} />
          </div>
        </div>
      )}

      <div style={{ padding: "16px 16px 0" }}>
        <TelegramMainButton label="напомнить" enabled={customReady} onClick={confirm} />
      </div>
    </BottomSheet>
  );
}
