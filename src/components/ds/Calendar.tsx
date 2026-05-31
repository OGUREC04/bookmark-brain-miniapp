/* DS-календарь (выбор даты) — на токенах дизайн-системы, замена нативному пикеру.
   Неделя с понедельника. Возвращает дату как "YYYY-MM-DD". */
import { useState, cloneElement } from "react";
import { Icons } from "./icons";

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];
const MONTHS = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toISO(y: number, m: number, d: number): string {
  return `${y}-${pad2(m + 1)}-${pad2(d)}`;
}

/** Индекс дня недели с понедельника (0=пн … 6=вс). */
function mondayIndex(jsDay: number): number {
  return (jsDay + 6) % 7;
}

export function Calendar({
  value,
  onSelect,
  compact = false,
}: {
  value: string | null;
  onSelect: (iso: string) => void;
  /** Компактный режим — меньше ячейки/отступы (чтобы под календарём влез time-wheel). */
  compact?: boolean;
}) {
  const today = new Date();
  const initial = value ? new Date(value) : today;
  const [view, setView] = useState({ y: initial.getFullYear(), m: initial.getMonth() });

  const firstDow = mondayIndex(new Date(view.y, view.m, 1).getDay());
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const todayISO = toISO(today.getFullYear(), today.getMonth(), today.getDate());

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const shiftMonth = (delta: number) => {
    setView((v) => {
      const m = v.m + delta;
      return { y: v.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 };
    });
  };

  return (
    <div>
      {/* Шапка: месяц + навигация */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: compact ? 6 : 12 }}>
        <span style={{ fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600, color: "var(--fg-1)", letterSpacing: "-0.01em" }}>
          {MONTHS[view.m]} {view.y}
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <NavBtn
            label="предыдущий месяц"
            onClick={() => shiftMonth(-1)}
            flip
            disabled={view.y < today.getFullYear() || (view.y === today.getFullYear() && view.m <= today.getMonth())}
          />
          <NavBtn label="следующий месяц" onClick={() => shiftMonth(1)} />
        </div>
      </div>

      {/* Дни недели */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {WEEKDAYS.map((w) => (
          <span
            key={w}
            style={{
              textAlign: "center",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 500,
              color: "var(--fg-3)",
              textTransform: "uppercase",
              letterSpacing: ".06em",
              padding: "2px 0",
            }}
          >
            {w}
          </span>
        ))}
      </div>

      {/* Сетка дней */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />;
          const iso = toISO(view.y, view.m, d);
          const selected = iso === value;
          const isToday = iso === todayISO;
          const isPast = iso < todayISO; // прошлые даты выбрать нельзя
          return (
            <button
              key={iso}
              type="button"
              disabled={isPast}
              onClick={() => !isPast && onSelect(iso)}
              aria-label={iso}
              aria-pressed={selected}
              aria-disabled={isPast}
              style={{
                ...(compact ? { height: 30 } : { aspectRatio: "1 / 1" }),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-ui)",
                fontSize: 13.5,
                fontWeight: selected ? 600 : 500,
                color: selected ? "var(--fg-on-brand)" : isPast ? "var(--fg-4)" : "var(--fg-1)",
                opacity: isPast ? 0.4 : 1,
                background: selected ? "var(--brand-primary)" : "transparent",
                border: isToday && !selected ? "1.5px solid var(--brand-primary)" : "1.5px solid transparent",
                borderRadius: 10,
                cursor: isPast ? "default" : "pointer",
                textDecoration: isPast ? "line-through" : "none",
                WebkitTapHighlightColor: "transparent",
                transition: "background 120ms var(--ease-out)",
              }}
            >
              {d}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NavBtn({ label, onClick, flip, disabled }: { label: string; onClick: () => void; flip?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onClick()}
      style={{
        width: 30,
        height: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-sunken)",
        border: "none",
        borderRadius: 9,
        color: "var(--fg-2)",
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? "default" : "pointer",
        transform: flip ? "scaleX(-1)" : undefined,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {cloneElement(Icons.arrow, { size: 16, sw: 1.8 } as never)}
    </button>
  );
}
