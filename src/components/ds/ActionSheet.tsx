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
  target,
  onDismiss,
  onRemind,
  onStar,
  onMove,
  onDelete,
}: {
  target: SheetTarget;
  onDismiss?: () => void;
  onRemind?: () => void;
  onStar?: () => void;
  onMove?: () => void;
  onDelete?: () => void;
}) {
  const items = [
    { id: "remind", icon: ExtraIcons.clock, label: "напомнить", sub: "выбрать время", on: onRemind },
    { id: "star", glyph: "★", label: "в избранное", sub: null, on: onStar },
    { id: "space", icon: ExtraIcons.folder, label: "в пространство", sub: "выбрать", on: onMove },
    { id: "del", icon: ExtraIcons.trash, label: "удалить", sub: null, danger: true, on: onDelete },
  ] as const;
  return (
    <BottomSheet onDismiss={onDismiss}>
      <div
        style={{
          margin: "0 16px 6px",
          padding: "10px 14px",
          background: "rgba(234,227,207,0.45)",
          border: "1px solid var(--border-1)",
          borderRadius: 14,
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #8FA888 0%, #4A6648 100%)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-ui)",
            fontWeight: 500,
            fontSize: 13,
          }}
        >
          {target.letter}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: "var(--fg-1)",
              letterSpacing: "-0.01em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {target.title}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-3)", letterSpacing: ".06em" }}>
            {target.src}
          </div>
        </div>
      </div>

      <div style={{ padding: "4px 6px 4px" }}>
        {items.map((it) => (
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
