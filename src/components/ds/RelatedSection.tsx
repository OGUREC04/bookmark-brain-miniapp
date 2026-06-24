/* RelatedSection — «Связано»: похожие заметки в карточке (Connections Phase 5A).
   Паттерн — ClickUp «Relationships», перекрашен под наш editorial-DS. Плоские пропсы;
   данные грузит DetailScreen (ds-слой не импортит lib/).
   Действия («Посмотреть все», «Граф связей») — подписанными кнопками ВНИЗУ шторки. */
import { cloneElement } from "react";
import { Icons } from "./icons";

export interface RelatedRow {
  id: string;
  title: string;
  summary: string | null;
}

export function RelatedSection({
  rows,
  total,
  showingAll,
  onOpen,
  onShowAll,
  onOpenGraph,
}: {
  rows: RelatedRow[];
  /** Истинное число связей (для бейджа). */
  total: number;
  showingAll: boolean;
  onOpen: (id: string) => void;
  onShowAll: () => void;
  /** Открыть локальный граф вокруг заметки. undefined — кнопки нет. */
  onOpenGraph?: () => void;
}) {
  if (total === 0 || rows.length === 0) return null;
  const canExpand = !showingAll && total > rows.length;

  return (
    <div style={{ marginBottom: 22 }}>
      {/* Шапка — только заголовок + счётчик; действия ушли вниз кнопками. */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 600, color: "var(--fg-1)", letterSpacing: "-0.01em" }}>
          Связано
        </span>
        <span
          style={{
            minWidth: 18,
            height: 18,
            padding: "0 6px",
            borderRadius: 999,
            background: "var(--brand-primary)",
            color: "var(--fg-on-brand)",
            fontFamily: "var(--font-ui)",
            fontSize: 10.5,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {total}
        </span>
      </div>

      <div style={{ borderTop: "0.5px solid var(--border-1)" }}>
        {rows.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onOpen(r.id)}
            style={{
              width: "100%",
              textAlign: "left",
              background: "transparent",
              border: "none",
              borderBottom: "0.5px solid var(--border-1)",
              padding: "16px 2px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 12,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "var(--font-ui)",
                  fontSize: 14.5,
                  fontWeight: 500,
                  color: "var(--fg-1)",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.3,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {r.title}
              </div>
              {r.summary && (
                <div
                  style={{
                    fontFamily: "var(--font-ui)",
                    fontSize: 12.5,
                    color: "var(--fg-3)",
                    lineHeight: 1.4,
                    marginTop: 4,
                    display: "-webkit-box",
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {r.summary}
                </div>
              )}
            </span>
            <span style={{ color: "var(--fg-4)", display: "flex", flexShrink: 0 }}>
              {cloneElement(Icons.arrow, { size: 15, sw: 1.6 } as never)}
            </span>
          </button>
        ))}
      </div>

      {/* Действия — подписанными кнопками внизу шторки. */}
      {(canExpand || onOpenGraph) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
          {canExpand && (
            <button
              type="button"
              onClick={onShowAll}
              style={{
                width: "100%",
                padding: "12px 0",
                borderRadius: 12,
                border: "none",
                background: "var(--brand-primary-tint)",
                color: "var(--brand-primary-press)",
                fontFamily: "var(--font-ui)",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              Посмотреть все ({total})
            </button>
          )}
          {onOpenGraph && (
            <button
              type="button"
              onClick={onOpenGraph}
              style={{
                width: "100%",
                padding: "12px 0",
                borderRadius: 12,
                border: "0.5px solid var(--border-1)",
                background: "transparent",
                color: "var(--brand-primary)",
                fontFamily: "var(--font-ui)",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {cloneElement(Icons.graph, { size: 17, sw: 1.7 } as never)}
              Граф связей
            </button>
          )}
        </div>
      )}
    </div>
  );
}
