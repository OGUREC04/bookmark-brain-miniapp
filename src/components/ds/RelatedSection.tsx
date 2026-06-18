/* RelatedSection — «Связано»: похожие заметки в карточке (Connections Phase 5A).
   Паттерн — ClickUp «Relationships» (заголовок+счётчик+«посмотреть все»+строки),
   перекрашен под наш editorial-DS. Плоские пропсы; данные грузит DetailScreen
   (ds-слой не импортит lib/). */
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
  /** Открыть локальный граф вокруг заметки (иконка в шапке). undefined — кнопки нет. */
  onOpenGraph?: () => void;
}) {
  if (total === 0 || rows.length === 0) return null;
  const canExpand = !showingAll && total > rows.length;

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
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
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          {canExpand && (
            <button
              type="button"
              onClick={onShowAll}
              style={{
                background: "transparent",
                border: "none",
                padding: "2px 0",
                color: "var(--brand-primary)",
                fontFamily: "var(--font-ui)",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              Посмотреть все
            </button>
          )}
          {onOpenGraph && (
            <button
              type="button"
              aria-label="граф связей"
              onClick={onOpenGraph}
              style={{
                display: "flex",
                alignItems: "center",
                background: "transparent",
                border: "none",
                padding: 0,
                color: "var(--brand-primary)",
                cursor: "pointer",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {cloneElement(Icons.graph, { size: 17, sw: 1.7 } as never)}
            </button>
          )}
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
    </div>
  );
}
