/* CreateReminderSheet — создание САМОСТОЯТЕЛЬНОГО напоминания из шторки 🔔 (не из заметки).
   Два типа: «Разово» (текст + дата + время → POST /reminders, bookmark_id=null) и
   «Каждый день» (текст + время → POST /recurring, бэк daily-only). Реюз Calendar + TimeWheel. */
import { useState, useEffect, cloneElement } from "react";
import { createPortal } from "react-dom";
import { Icons, ExtraIcons } from "./icons";
import { BottomSheet, SheetTitle, TelegramMainButton } from "./sheetPrimitives";
import { Calendar } from "./Calendar";
import { TimeWheel } from "./TimeWheel";
import { canCreateRecurring } from "../../lib/recurring";

const MON = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const pad2 = (n: number) => (n < 10 ? `0${n}` : String(n));
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function dayISO(offset = 0): string {
  const t = new Date();
  t.setDate(t.getDate() + offset);
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
}
function customToISO(dateISO: string, h: number, m: number): string {
  const [y, mo, d] = dateISO.split("-").map(Number);
  return new Date(y, mo - 1, d, h, m, 0, 0).toISOString();
}
function dayLabel(dateISO: string): string {
  if (dateISO === dayISO(0)) return "Сегодня";
  if (dateISO === dayISO(1)) return "Завтра";
  const [, mo, d] = dateISO.split("-").map(Number);
  return `${d} ${MON[mo - 1]}`;
}

type Mode = "once" | "daily";

export function CreateReminderSheet({
  onDismiss,
  onBack,
  onCreateOnce,
  onCreateDaily,
}: {
  onDismiss?: () => void;
  onBack?: () => void;
  /** Разово: ISO момента (локальное → UTC) + текст. */
  onCreateOnce: (fireAtISO: string, text: string) => void;
  /** Ежедневно: текст + час/минута (App соберёт raw для бэка). */
  onCreateDaily: (text: string, hour: number, minute: number) => void;
}) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<Mode>("once");
  const [date, setDate] = useState(dayISO(0));
  const now = new Date();
  const [hour, setHour] = useState(Math.min(23, now.getHours() + 1));
  const [minute, setMinute] = useState(0);
  const [timeOpen, setTimeOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);

  // Escape закрывает поповер времени (Telegram Desktop/web).
  useEffect(() => {
    if (!timeOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setTimeOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [timeOpen]);

  const hasText = text.trim().length > 0;
  const onceISO = customToISO(date, hour, minute);
  const onceFuture = new Date(onceISO).getTime() > Date.now();
  const enabled =
    mode === "once" ? hasText && onceFuture : canCreateRecurring(text, hour, minute);

  const isToday = date === dayISO(0);
  const isTomorrow = date === dayISO(1);

  const submit = () => {
    if (!enabled) return;
    if (mode === "once") onCreateOnce(onceISO, text.trim());
    else onCreateDaily(text.trim(), hour, minute);
  };

  const seg = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      style={{
        flex: 1,
        padding: "8px 0",
        borderRadius: 9,
        border: "none",
        cursor: "pointer",
        fontFamily: "var(--font-ui)",
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: "-0.005em",
        background: mode === m ? "var(--bg-surface)" : "transparent",
        color: mode === m ? "var(--fg-1)" : "var(--fg-3)",
        boxShadow: mode === m ? "0 1px 3px rgba(60,40,25,0.12)" : "none",
      }}
    >
      {label}
    </button>
  );

  const chip = (active: boolean, onClick: () => void, content: React.ReactNode) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "8px 14px",
        borderRadius: 999,
        cursor: "pointer",
        fontFamily: "var(--font-ui)",
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: "-0.005em",
        background: active ? "var(--brand-primary-tint)" : "transparent",
        border: active ? "1px solid rgba(122,156,122,0.4)" : "1px solid var(--border-strong)",
        color: active ? "var(--brand-primary-press)" : "var(--fg-2)",
      }}
    >
      {content}
    </button>
  );

  return (
    <BottomSheet onDismiss={onDismiss}>
      <SheetTitle title="Новое напоминание" onBack={onBack} onClose={onDismiss} />

      {/* Текст */}
      <div style={{ padding: "0 16px" }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          placeholder="Напомнить о чём?"
          className="compose-input"
          style={{
            width: "100%",
            boxSizing: "border-box",
            padding: "13px 14px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-1)",
            borderRadius: 14,
            outline: "none",
            fontFamily: "var(--font-ui)",
            fontSize: 16,
            color: "var(--fg-1)",
            letterSpacing: "-0.005em",
          }}
        />
      </div>

      {/* Тип: разово / каждый день */}
      <div style={{ display: "flex", gap: 4, margin: "14px 16px 0", background: "var(--bg-sunken)", borderRadius: 12, padding: 3 }}>
        {seg("once", "Разово")}
        {seg("daily", "Каждый день")}
      </div>

      {/* Дата (только для разового) */}
      {mode === "once" && (
        <div style={{ padding: "14px 16px 0" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {chip(isToday && !calOpen, () => { setDate(dayISO(0)); setCalOpen(false); }, "Сегодня")}
            {chip(isTomorrow && !calOpen, () => { setDate(dayISO(1)); setCalOpen(false); }, "Завтра")}
            {chip(calOpen, () => setCalOpen((v) => !v),
              <>{cloneElement(ExtraIcons.calendar, { size: 14, sw: 1.7 } as never)}<span>{calOpen ? dayLabel(date) : "Дата"}</span></>)}
          </div>
          {calOpen && (
            <div style={{ marginTop: 12 }}>
              <Calendar value={date} onSelect={setDate} compact />
            </div>
          )}
        </div>
      )}

      {/* Время — общая строка, открывает барабан поповером */}
      <div style={{ padding: "14px 16px 0" }}>
        <button
          type="button"
          onClick={() => setTimeOpen(true)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "13px 14px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border-1)",
            borderRadius: 14,
            cursor: "pointer",
            color: "var(--fg-1)",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {cloneElement(ExtraIcons.clock, { size: 18, sw: 1.7 } as never)}
          <span style={{ flex: 1, textAlign: "left", fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 500, letterSpacing: "-0.01em" }}>Время</span>
          <span style={{ padding: "4px 12px", borderRadius: 999, background: "var(--brand-primary-tint)", border: "1px solid rgba(122,156,122,0.35)", color: "var(--brand-primary-press)", fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600 }}>
            {pad2(hour)}:{pad2(minute)}
          </span>
        </button>
      </div>

      {/* Превью того, что создастся */}
      <div style={{ padding: "12px 16px 0", textAlign: "center", fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 13, color: "var(--fg-3)" }}>
        {mode === "daily"
          ? `Каждый день в ${pad2(hour)}:${pad2(minute)}`
          : onceFuture
            ? `${dayLabel(date)} в ${pad2(hour)}:${pad2(minute)}`
            : "Выбери время в будущем"}
      </div>

      <div style={{ padding: "16px 16px 4px" }}>
        <TelegramMainButton
          label="Создать"
          enabled={enabled}
          onClick={submit}
          disabledHint={!hasText ? "О чём напомнить?" : "Выбери время в будущем"}
        />
      </div>

      {/* Барабан времени — поповер поверх (как в ReminderPickerSheet). */}
      {timeOpen && createPortal(
        <div
          onClick={() => setTimeOpen(false)}
          onTouchMove={(e) => e.preventDefault()}
          style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(28,22,18,0.22)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, touchAction: "none" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="выбор времени"
            style={{ width: "min(320px, 86vw)", background: "rgba(255,252,246,0.98)", backdropFilter: "blur(20px) saturate(160%)", WebkitBackdropFilter: "blur(20px) saturate(160%)", borderRadius: 22, border: "1px solid rgba(255,255,255,0.7)", boxShadow: "0 12px 40px rgba(60,40,25,0.22)", padding: "14px 14px 12px" }}
          >
            <div style={{ textAlign: "center", fontFamily: "var(--font-ui)", fontSize: 14, fontWeight: 600, color: "var(--fg-2)", marginBottom: 6 }}>Время</div>
            <TimeWheel hour={hour} minute={minute} onChange={(h, m) => { setHour(h); setMinute(m); }} />
            <button
              type="button"
              onClick={() => setTimeOpen(false)}
              style={{ width: "100%", marginTop: 12, padding: 12, borderRadius: 12, background: "var(--brand-primary)", color: "var(--fg-on-brand)", border: "none", fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 500, cursor: "pointer" }}
            >
              Готово
            </button>
          </div>
        </div>,
        document.body,
      )}
    </BottomSheet>
  );
}
