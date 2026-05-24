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
}: {
  value: string | null;
  onSelect: (iso: string) => void;
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600, color: "var(--fg-1)", letterSpacing: "-0.01em" }}>
          {MONTHS[view.m]} {view.y}
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <NavBtn label="предыдущий месяц" onClick={() => shiftMonth(-1)} flip />
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
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelect(iso)}
              aria-label={iso}
              aria-pressed={selected}
              style={{
                aspectRatio: "1 / 1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-ui)",
                fontSize: 13.5,
                fontWeight: selected ? 600 : 500,
                color: selected ? "var(--fg-on-brand)" : "var(--fg-1)",
                background: selected ? "var(--brand-primary)" : "transparent",
                border: isToday && !selected ? "1.5px solid var(--brand-primary)" : "1.5px solid transparent",
                borderRadius: 10,
                cursor: "pointer",
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

function NavBtn({ label, onClick, flip }: { label: string; onClick: () => void; flip?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
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
        cursor: "pointer",
        transform: flip ? "scaleX(-1)" : undefined,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {cloneElement(Icons.arrow, { size: 16, sw: 1.8 } as never)}
    </button>
  );
}
