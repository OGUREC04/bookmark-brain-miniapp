/* ReminderPickerSheet — время над текстом + редактируемый текст (как пункт списка) +
   пресеты-карточки (при переносе первая = исходное время) + календарь.
   Кнопка активна только если время/текст изменились. Sentence-case. */
import { useState, useRef, useCallback, cloneElement } from "react";
import { Icons, ExtraIcons } from "./icons";
import { Glyph } from "./atoms";
import { BottomSheet, SheetTitle, TelegramMainButton } from "./sheetPrimitives";
import { Calendar } from "./Calendar";
import { TimeWheel } from "./TimeWheel";

const CUSTOM = "custom";
const ORIGINAL = "original";
const MON = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
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
/** {day:"Завтра", time:"18:00"} — sentence-case день. */
function fmtParts(d: Date): { day: string; time: string } {
  const now = new Date();
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const tom = new Date(now);
  tom.setDate(now.getDate() + 1);
  const time = `${d.getHours()}:${pad2(d.getMinutes())}`;
  let day: string;
  if (same(d, now)) day = "сегодня";
  else if (same(d, tom)) day = "завтра";
  else day = `${d.getDate()} ${MON[d.getMonth()]}`;
  return { day: cap(day), time };
}

export function ReminderPickerSheet({
  contextText,
  initialISO,
  onDismiss,
  onBack,
  onConfirm,
}: {
  contextText: string;
  initialISO?: string | null;
  onDismiss?: () => void;
  onBack?: () => void;
  onConfirm?: (fireAtISO: string, text: string) => void;
}) {
  const init = initialISO ? new Date(initialISO) : null;

  // Пресеты: при переносе первая карточка = исходное время (выбрана по умолчанию).
  const presets = init
    ? [
        { id: ORIGINAL, label: fmtParts(init).day, sub: fmtParts(init).time, iso: initialISO! },
        { id: "tonight", label: "Сегодня вечером", sub: "18:00" },
        { id: "morning", label: "Завтра утром", sub: "9:00" },
        { id: "weekend", label: "На выходные", sub: "сб 10:00" },
      ]
    : [
        { id: "tonight", label: "Сегодня вечером", sub: "18:00" },
        { id: "morning", label: "Завтра утром", sub: "9:00" },
        { id: "weekend", label: "На выходные", sub: "сб 10:00" },
        { id: "week", label: "Через неделю", sub: "пт 9:00" },
      ];

  // Дефолт: при переносе — исходное время; при создании — ничего (кнопка disabled).
  const [picked, setPicked] = useState<string>(init ? ORIGINAL : "");
  const [date, setDate] = useState<string>(
    init ? `${init.getFullYear()}-${pad2(init.getMonth() + 1)}-${pad2(init.getDate())}` : todayISO()
  );
  const [hour, setHour] = useState(init ? init.getHours() : Math.min(23, new Date().getHours() + 1));
  const [minute, setMinute] = useState(init ? init.getMinutes() : 0);
  const [text, setText] = useState(contextText);

  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const autoGrow = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  const isCustom = picked === CUSTOM;
  const resolved: Date | null = isCustom
    ? date
      ? new Date(customToISO(date, hour, minute))
      : null
    : picked === ORIGINAL
      ? new Date(initialISO!)
      : picked
        ? new Date(slotToISO(picked))
        : null;

  const isFuture = resolved !== null && resolved.getTime() > Date.now();
  const parts = resolved ? fmtParts(resolved) : null;

  // Кнопка активна только если что-то изменилось (время ≠ исходного ИЛИ текст изменён).
  // Сравниваем timestamp, не ISO-строку (бэк может вернуть другую точность/таймзону).
  const timeChanged =
    resolved !== null && (!initialISO || resolved.getTime() !== new Date(initialISO).getTime());
  const textChanged = text.trim() !== contextText.trim();
  const enabled = isFuture && (timeChanged || textChanged) && resolved !== null;

  const confirm = () => {
    if (resolved && enabled) onConfirm?.(resolved.toISOString(), text.trim() || contextText);
  };

  const cardStyle = (on: boolean) =>
    ({
      position: "relative",
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: 6,
      minHeight: 68,
      padding: "13px 14px",
      background: on ? "var(--brand-primary-tint)" : "rgba(255,252,246,0.7)",
      border: on ? "1.5px solid rgba(122,156,122,0.55)" : "1px solid rgba(255,255,255,0.7)",
      borderRadius: 16,
      cursor: "pointer",
      textAlign: "left",
      color: "var(--fg-1)",
      boxShadow: on ? "none" : "var(--shadow-glass-chip)",
    }) as const;

  return (
    <BottomSheet onDismiss={onDismiss}>
      <SheetTitle
        title="Напомнить"
        onBack={isCustom ? () => setPicked(init ? ORIGINAL : "") : onBack}
        onClose={isCustom ? undefined : onDismiss}
      />

      {/* время + текст — закреплены (не скроллятся), чтобы всегда были видны */}
      {/* время — НАД основным текстом, акцентом */}
        <div style={{ padding: "0 16px 8px" }}>
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 17,
              fontWeight: 600,
              color: parts ? "var(--brand-primary-press)" : "var(--fg-3)",
              letterSpacing: "-0.01em",
            }}
          >
            {parts ? `${parts.day}, ${parts.time}` : "Выбери время"}
          </span>
        </div>

        {/* редактируемый текст — как пункт списка (textarea, brand-caret, ×-очистка) */}
        <div
          style={{
            margin: "0 16px 14px",
            padding: "12px 14px",
            background: "rgba(234,227,207,0.45)",
            border: "1px solid var(--border-1)",
            borderRadius: 14,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <span style={{ marginTop: 2 }}>
            <Glyph ch="✦" size={20} />
          </span>
          <textarea
            ref={taRef}
            value={text}
            rows={1}
            onChange={(e) => {
              setText(e.target.value);
              autoGrow();
            }}
            aria-label="текст напоминания"
            placeholder="о чём напомнить"
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              outline: "none",
              background: "transparent",
              resize: "none",
              overflow: "hidden",
              fontFamily: "var(--font-ui)",
              fontSize: 15.5,
              fontWeight: 500,
              lineHeight: 1.4,
              color: "var(--fg-1)",
              caretColor: "var(--brand-primary)",
              letterSpacing: "-0.01em",
            }}
          />
          {text.length > 0 && (
            <button
              type="button"
              aria-label="очистить текст"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setText("");
                taRef.current?.focus();
                autoGrow();
              }}
              style={{
                flexShrink: 0,
                width: 22,
                height: 22,
                marginTop: 1,
                borderRadius: "50%",
                border: "none",
                background: "rgba(60,40,25,0.08)",
                color: "var(--fg-3)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
              }}
            >
              {cloneElement(Icons.close, { size: 12, sw: 2 } as never)}
            </button>
          )}
        </div>

      {/* скролл-область: пресеты ИЛИ календарь+барабан (всё выше — закреплено) */}
      <div style={{ maxHeight: "58vh", overflowY: "auto", overscrollBehavior: "contain" }}>
        {!isCustom && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "0 16px" }}>
              {presets.map((s) => {
                const on = picked === s.id;
                return (
                  <button key={s.id} onClick={() => setPicked(s.id)} style={cardStyle(on)}>
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
                <span style={{ flex: 1, textAlign: "left" }}>Выбрать дату и время</span>
                {cloneElement(Icons.arrow, { size: 16, sw: 1.7 } as never)}
              </button>
            </div>
          </>
        )}

        {isCustom && (
          <div style={{ padding: "0 16px" }}>
            <Calendar value={date} onSelect={setDate} compact />
            <div style={{ marginTop: 6, borderTop: "1px solid var(--border-1)", paddingTop: 2 }}>
              <TimeWheel hour={hour} minute={minute} compact onChange={(h, m) => { setHour(h); setMinute(m); }} />
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "14px 16px 0" }}>
        <TelegramMainButton
          label="Напомнить"
          enabled={enabled}
          onClick={confirm}
          disabledHint={!isFuture ? "Выбери время в будущем" : "Измени время или текст"}
        />
      </div>
    </BottomSheet>
  );
}
