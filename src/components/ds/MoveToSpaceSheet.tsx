/* MoveToSpaceSheet. Ported 1:1; styles verbatim. */
import { useState, cloneElement } from "react";
import { Icons } from "./icons";
import { Glyph } from "./atoms";
import { BottomSheet, SheetTitle } from "./sheetPrimitives";

export interface SpaceOption {
  id: string;
  name: string;
  count: number;
  glyph?: string;
}

export function MoveToSpaceSheet({
  spaces,
  onDismiss,
  onBack,
  onPick,
  onCreate,
}: {
  spaces: SpaceOption[];
  onDismiss?: () => void;
  /** Шаг назад к меню действий (‹). */
  onBack?: () => void;
  onPick?: (id: string) => void;
  onCreate?: () => void;
}) {
  const [picked, setPicked] = useState<string>("");
  return (
    <BottomSheet onDismiss={onDismiss}>
      <SheetTitle title="в пространство" onBack={onBack} onClose={onDismiss} />
      <div style={{ padding: "0 12px" }}>
        {spaces.slice(0, 6).map((s) => {
          const on = picked === s.id;
          return (
            <button
              key={s.id}
              onClick={() => {
                setPicked(s.id);
                onPick?.(s.id);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                padding: "10px 12px",
                background: on ? "var(--brand-primary-tint)" : "transparent",
                border: "1px solid " + (on ? "rgba(122,156,122,0.35)" : "transparent"),
                borderRadius: 12,
                cursor: "pointer",
                textAlign: "left",
                marginBottom: 2,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  background: "linear-gradient(135deg, rgba(143,168,136,0.7), rgba(74,102,72,0.7))",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Glyph ch={s.glyph || "·"} size={16} color="currentColor" />
              </div>
              <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500, letterSpacing: "-0.01em", color: "var(--fg-1)" }}>
                {s.name}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-3)", letterSpacing: ".06em" }}>
                {s.count}
              </span>
              {on && (
                <span style={{ color: "var(--brand-primary)", display: "flex" }}>
                  {cloneElement(Icons.check, { size: 16, sw: 2.2 } as never)}
                </span>
              )}
            </button>
          );
        })}
        <button
          onClick={onCreate}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            width: "100%",
            padding: "10px 12px",
            marginTop: 4,
            background: "transparent",
            border: "1px dashed var(--border-strong)",
            borderRadius: 12,
            cursor: "pointer",
            textAlign: "left",
            color: "var(--brand-primary)",
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: "rgba(255,252,246,0.7)",
              border: "1px solid var(--border-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {cloneElement(Icons.plus, { size: 16, sw: 1.8 } as never)}
          </div>
          <span style={{ flex: 1, fontSize: 14.5, fontWeight: 500, letterSpacing: "-0.01em" }}>создать пространство</span>
        </button>
      </div>
    </BottomSheet>
  );
}
