/* ReminderPickerSheet — пресет-слоты (radio) + «выбрать дату и время» (кнопка,
   раскрывает DS-календарь + колесо). Выбранное время — в заголовке акцентом.
   Прошлые даты задизейблены; кнопка «напомнить» недоступна для времени в прошлом. */
import { useState, cloneElement } from "react";
import { Icons, ExtraIcons } from "./icons";
import { Glyph } from "./atoms";
import { BottomSheet, SheetTitle, TelegramMainButton } from "./sheetPrimitives";
import { Calendar } from "./Calendar";
import { TimeWheel } from "./TimeWheel";

const SLOTS = [
  { id: "tonight", label: "сегодня вечером", sub: "в 18:00" },
  { id: "morning", label: "завтра утром", sub: "в 9:00" },
  { id: "weekend", label: "на выходные", sub: "сб, 10:00" },
  { id: "week", label: "через неделю", sub: "пт, 9:00" },
] as const;

const CUSTOM = "custom";
const MON = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function todayISO(): string {
  const t = new Date();
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
}

function customToISO(dateISO: string, h: number, m: number): string {
  const [y, mo, d] = dateISO.split("-").map(Number);
  return new Date(y, mo - 1, d, h, m, 0, 0).toISOString();
}

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

/** "сегодня 18:00" / "завтра 9:00" / "31 мая 23:00". */
function fmtWhen(d: Date): string {
  const now = new Date();
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const tom = new Date(now);
  tom.setDate(now.getDate() + 1);
  const hm = `${d.getHours()}:${pad2(d.getMinutes())}`;
  if (same(d, now)) return `сегодня ${hm}`;
  if (same(d, tom)) return `завтра ${hm}`;
  return `${d.getDate()} ${MON[d.getMonth()]} ${hm}`;
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
  // По умолчанию — сегодня + ближайший будущий час (чтобы кнопка сразу была валидна).
  const [date, setDate] = useState<string>(todayISO());
  const [hour, setHour] = useState(() => Math.min(23, new Date().getHours() + 1));
  const [minute, setMinute] = useState(0);

  const isCustom = picked === CUSTOM;
  const resolved: Date | null = isCustom
    ? date
      ? new Date(customToISO(date, hour, minute))
      : null
    : new Date(slotToISO(picked));

  const isFuture = resolved !== null && resolved.getTime() > Date.now();
  const whenLabel = resolved ? fmtWhen(resolved) : null;

  const confirm = () => {
    if (resolved && isFuture) onConfirm?.(resolved.toISOString());
  };

  return (
    <BottomSheet onDismiss={onDismiss}>
      <SheetTitle
        title="напомнить"
        onClose={onDismiss}
        right={
          whenLabel ? (
            <span style={{ color: "var(--brand-primary-press)", fontWeight: 600, fontSize: 12 }}>{whenLabel}</span>
          ) : undefined
        }
      />

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
      </div>

      {/* «выбрать дату и время» — КНОПКА (не radio), раскрывает календарь */}
      <div style={{ padding: "8px 16px 0" }}>
        <button
          onClick={() => setPicked(isCustom ? "tonight" : CUSTOM)}
          aria-expanded={isCustom}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            background: isCustom ? "var(--brand-primary-tint)" : "transparent",
            border: `1px solid ${isCustom ? "rgba(122,156,122,0.45)" : "var(--border-strong)"}`,
            borderRadius: 14,
            cursor: "pointer",
            color: isCustom ? "var(--brand-primary-press)" : "var(--fg-1)",
            fontFamily: "var(--font-ui)",
            fontSize: 14.5,
            fontWeight: 500,
            letterSpacing: "-0.01em",
          }}
        >
          {cloneElement(ExtraIcons.calendar, { size: 17, sw: 1.7 } as never)}
          <span style={{ flex: 1, textAlign: "left" }}>выбрать дату и время</span>
          <span style={{ display: "flex", transform: isCustom ? "rotate(90deg)" : "none", transition: "transform 180ms var(--ease-out)" }}>
            {cloneElement(Icons.arrow, { size: 15, sw: 1.7 } as never)}
          </span>
        </button>
      </div>

      {/* DS-календарь + время — раскрывается при выборе «своя дата». */}
      {isCustom && (
        <div style={{ padding: "12px 16px 0" }}>
          <Calendar value={date} onSelect={setDate} />
          <div style={{ marginTop: 8, borderTop: "1px solid var(--border-1)", paddingTop: 4 }}>
            <TimeWheel hour={hour} minute={minute} onChange={(h, m) => { setHour(h); setMinute(m); }} />
          </div>
        </div>
      )}

      <div style={{ padding: "16px 16px 0" }}>
        <TelegramMainButton
          label="напомнить"
          enabled={isFuture}
          onClick={confirm}
          disabledHint={isCustom ? "выбери дату и время в будущем" : "выбери время"}
        />
      </div>
    </BottomSheet>
  );
}
