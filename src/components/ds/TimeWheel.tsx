/* DS time-wheel — две прокручиваемые колонки (часы/минуты) со scroll-snap,
   выбор по центральной позиции. Любое время ЧЧ:ММ (шаг минут 1). */
import { useRef, useState, useLayoutEffect, useCallback } from "react";

const ITEM = 34; // высота строки

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function WheelColumn({
  values,
  index,
  onIndex,
  align,
  visible,
}: {
  values: string[];
  index: number;
  onIndex: (i: number) => void;
  align: "right" | "left";
  visible: number;
}) {
  const PAD = ((visible - 1) / 2) * ITEM;
  const ref = useRef<HTMLDivElement>(null);
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // начальная позиция — без анимации на выбранный индекс
  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = index * ITEM;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const i = Math.round(el.scrollTop / ITEM);
    if (i !== index && i >= 0 && i < values.length) onIndex(i);
    // мягкий snap после остановки
    if (settleRef.current) clearTimeout(settleRef.current);
    settleRef.current = setTimeout(() => {
      const target = Math.round(el.scrollTop / ITEM) * ITEM;
      if (Math.abs(el.scrollTop - target) > 1) el.scrollTo({ top: target, behavior: "smooth" });
    }, 90);
  }, [index, onIndex, values.length]);

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      style={{
        height: visible * ITEM,
        overflowY: "auto",
        scrollSnapType: "y mandatory",
        scrollbarWidth: "none",
        WebkitOverflowScrolling: "touch",
        flex: 1,
        position: "relative",
        zIndex: 1,
      }}
    >
      <div style={{ height: PAD }} />
      {values.map((v, i) => {
        const dist = Math.abs(i - index);
        return (
          <div
            key={v}
            style={{
              height: ITEM,
              display: "flex",
              alignItems: "center",
              justifyContent: align === "right" ? "flex-end" : "flex-start",
              paddingRight: align === "right" ? 10 : 0,
              paddingLeft: align === "left" ? 10 : 0,
              scrollSnapAlign: "center",
              fontFamily: "var(--font-mono)",
              fontSize: dist === 0 ? 22 : 18,
              fontWeight: dist === 0 ? 600 : 500,
              color: dist === 0 ? "var(--fg-1)" : "var(--fg-3)",
              opacity: dist === 0 ? 1 : Math.max(0.25, 1 - dist * 0.32),
              transition: "font-size 120ms var(--ease-out), color 120ms var(--ease-out)",
            }}
          >
            {v}
          </div>
        );
      })}
      <div style={{ height: PAD }} />
    </div>
  );
}

export function TimeWheel({
  hour,
  minute,
  onChange,
  compact = false,
}: {
  hour: number;
  minute: number;
  onChange: (h: number, m: number) => void;
  /** compact — 3 видимых строки вместо 5 (чтобы барабан влез под календарём). */
  compact?: boolean;
}) {
  const [hours] = useState(() => Array.from({ length: 24 }, (_, i) => pad2(i)));
  const [minutes] = useState(() => Array.from({ length: 60 }, (_, i) => pad2(i)));
  const VISIBLE = compact ? 3 : 5; // нечётное — центр выделен
  const PAD = ((VISIBLE - 1) / 2) * ITEM;

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "stretch", padding: "0 24px" }}>
      {/* центральная подсветка-«окно» */}
      <div
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          top: PAD,
          height: ITEM,
          borderRadius: 12,
          background: "var(--brand-primary-tint)",
          pointerEvents: "none",
        }}
      />
      <WheelColumn values={hours} index={hour} onIndex={(i) => onChange(i, minute)} align="right" visible={VISIBLE} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 14,
          fontFamily: "var(--font-mono)",
          fontSize: 22,
          fontWeight: 600,
          color: "var(--fg-1)",
          position: "relative",
          zIndex: 1,
        }}
      >
        :
      </div>
      <WheelColumn values={minutes} index={minute} onIndex={(i) => onChange(hour, i)} align="left" visible={VISIBLE} />
    </div>
  );
}
