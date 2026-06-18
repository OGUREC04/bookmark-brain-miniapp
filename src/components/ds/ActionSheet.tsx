/* ActionSheet — long-press on bookmark. Ported 1:1; styles verbatim. */
import { cloneElement } from "react";
import { ExtraIcons } from "./icons";
import { Glyph } from "./atoms";
import { BottomSheet } from "./sheetPrimitives";

export interface SheetTarget {
  id: string;
  title: string;
  src: string;
  letter: string;
}

export function ActionSheet({
  onDismiss,
  onRemind,
  onStar,
  onMove,
  onDelete,
}: {
  /** Заметка-цель (id для действий). Шапку убрали — поле для совместимости вызова. */
  target: SheetTarget;
  onDismiss?: () => void;
  onRemind?: () => void;
  onStar?: () => void;
  onMove?: () => void;
  onDelete?: () => void;
}) {
  const items = [
    { id: "remind", icon: ExtraIcons.clock, label: "Напомнить", sub: "Выбрать время", on: onRemind },
    { id: "star", glyph: "★", label: "В избранное", sub: null, on: onStar },
    { id: "space", icon: ExtraIcons.folder, label: "В пространство", sub: "Выбрать", on: onMove },
    { id: "del", icon: ExtraIcons.trash, label: "Удалить", sub: null, danger: true, on: onDelete },
  ] as const;
  return (
    <BottomSheet onDismiss={onDismiss}>
      {/* Без шапки с названием заметки: шторка открывается из ⋮ на конкретной
          заметке, контекст и так понятен; закрытие — тап по фону / свайп. */}
      <div style={{ padding: "4px 6px 4px" }}>
        {items.filter((it) => it.on).map((it) => (
          <button
            key={it.id}
            onClick={it.on}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              width: "100%",
              padding: "12px 14px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "danger" in it && it.danger ? "var(--semantic-error, #8A2A20)" : "var(--fg-1)",
              textAlign: "left",
            }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "danger" in it && it.danger ? "rgba(138,42,32,0.08)" : "rgba(234,227,207,0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "danger" in it && it.danger ? "var(--semantic-error, #8A2A20)" : "var(--brand-primary-press)",
                flexShrink: 0,
              }}
            >
              {"glyph" in it && it.glyph ? (
                <Glyph ch={it.glyph} size={18} color="currentColor" />
              ) : (
                cloneElement((it as { icon: React.ReactElement }).icon, { size: 18, sw: 1.6 } as never)
              )}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: "-0.01em" }}>{it.label}</div>
              {it.sub && (
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontStyle: "italic",
                    fontSize: 12.5,
                    color: "var(--fg-3)",
                    letterSpacing: 0,
                    marginTop: 2,
                  }}
                >
                  {it.sub}
                </div>
              )}
            </span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
