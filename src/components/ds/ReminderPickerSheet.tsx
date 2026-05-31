/* ReminderPickerSheet — редактируемый текст + пресеты-карточки (2 в ряд) +
   «выбрать дату и время» (раскрывает DS-календарь с кнопкой «назад»).
   Время — в заголовке акцентом. Прошлые даты/время недоступны. */
import { useState, cloneElement } from "react";
import { Icons, ExtraIcons } from "./icons";
import { Glyph } from "./atoms";
import { BottomSheet, SheetTitle, TelegramMainButton } from "./sheetPrimitives";
import { Calendar } from "./Calendar";
import { TimeWheel } from "./TimeWheel";

const SLOTS = [
  { id: "tonight", label: "сегодня вечером", sub: "18:00" },
  { id: "morning", label: "завтра утром", sub: "9:00" },
  { id: "weekend", label: "на выходные", sub: "сб 10:00" },
  { id: "week", label: "через неделю", sub: "пт 9:00" },
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
  initialISO,
  onDismiss,
  onBack,
  onConfirm,
}: {
  contextText: string;
  /** Существующее время (при переносе/редактировании) — пикер откроется на нём. */
  initialISO?: string | null;
  /** Закрыть шторку целиком (×, свайп, клик вне). */
  onDismiss?: () => void;
  /** Шаг назад к предыдущей шторке (‹ в режиме пресетов). */
  onBack?: () => void;
  onConfirm?: (fireAtISO: string, text: string) => void;
}) {
  const init = initialISO ? new Date(initialISO) : null;
  const [picked, setPicked] = useState<string>(init ? CUSTOM : "tonight");
  const [date, setDate] = useState<string>(
    init ? `${init.getFullYear()}-${pad2(init.getMonth() + 1)}-${pad2(init.getDate())}` : todayISO()
  );
  const [hour, setHour] = useState(init ? init.getHours() : Math.min(23, new Date().getHours() + 1));
  const [minute, setMinute] = useState(init ? init.getMinutes() : 0);
  const [text, setText] = useState(contextText);

  const isCustom = picked === CUSTOM;
  const resolved: Date | null = isCustom
    ? date
      ? new Date(customToISO(date, hour, minute))
      : null
    : new Date(slotToISO(picked));

  const isFuture = resolved !== null && resolved.getTime() > Date.now();
  const whenLabel = resolved ? fmtWhen(resolved) : null;

  const confirm = () => {
    if (resolved && isFuture) onConfirm?.(resolved.toISOString(), text.trim() || contextText);
  };

  return (
    <BottomSheet onDismiss={onDismiss}>
      <SheetTitle
        title={
          <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <span>напомнить</span>
            {whenLabel && (
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600, color: "var(--brand-primary-press)" }}>
                {whenLabel}
              </span>
            )}
          </span>
        }
        // custom: ‹ назад к пресетам, без × (закрыть свайпом/вне);
        // пресеты: ‹ к предыдущей шторке (если есть) + × закрыть.
        onBack={isCustom ? () => setPicked("tonight") : onBack}
        onClose={isCustom ? undefined : onDismiss}
      />

      {/* редактируемый текст напоминания — НЕ приглушённый, это важная инфа */}
      <div
        style={{
          margin: "0 16px 12px",
          padding: "12px 14px",
          background: "rgba(234,227,207,0.45)",
          border: "1px solid var(--border-1)",
          borderRadius: 14,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <Glyph ch="✦" size={20} />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="текст напоминания"
          placeholder="о чём напомнить"
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "transparent",
            fontFamily: "var(--font-ui)",
            fontSize: 15,
            fontWeight: 500,
            color: "var(--fg-1)",
            letterSpacing: "-0.01em",
          }}
        />
      </div>

      {!isCustom && (
        <>
          {/* пресеты — карточки по 2 в ряд (вид отличается от текста напоминания) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "0 16px" }}>
            {SLOTS.map((s) => {
              const on = picked === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setPicked(s.id)}
                  style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 6,
                    minHeight: 72,
                    padding: "14px 14px",
                    background: on ? "var(--brand-primary-tint)" : "rgba(255,252,246,0.7)",
                    border: on ? "1.5px solid rgba(122,156,122,0.55)" : "1px solid rgba(255,255,255,0.7)",
                    borderRadius: 16,
                    cursor: "pointer",
                    textAlign: "left",
                    color: "var(--fg-1)",
                    boxShadow: on ? "none" : "var(--shadow-glass-chip)",
                  }}
                >
                  {on && (
                    <span style={{ position: "absolute", top: 10, right: 10, color: "var(--brand-primary)", display: "flex" }}>
                      {cloneElement(Icons.check, { size: 15, sw: 2.5 } as never)}
                    </span>
                  )}
                  <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.2 }}>{s.label}</span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
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

          {/* «выбрать дату и время» — кнопка, раскрывает календарь */}
          <div style={{ padding: "8px 16px 0" }}>
            <button
              onClick={() => setPicked(CUSTOM)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "14px 16px",
                background: "transparent",
                border: "1px solid var(--border-strong)",
                borderRadius: 16,
                cursor: "pointer",
                color: "var(--fg-1)",
                fontFamily: "var(--font-ui)",
                fontSize: 15,
                fontWeight: 500,
                letterSpacing: "-0.01em",
              }}
            >
              {cloneElement(ExtraIcons.calendar, { size: 18, sw: 1.7 } as never)}
              <span style={{ flex: 1, textAlign: "left" }}>выбрать дату и время</span>
              {cloneElement(Icons.arrow, { size: 16, sw: 1.7 } as never)}
            </button>
          </div>
        </>
      )}

      {/* DS-календарь + время (кнопка «назад» — в заголовке шторки). */}
      {isCustom && (
        <div style={{ padding: "0 16px" }}>
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
