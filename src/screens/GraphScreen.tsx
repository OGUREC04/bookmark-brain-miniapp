/* GraphScreen — граф связей (Connections Phase 5A). Реф — Obsidian Graph view:
   точки-узлы + тонкие рёбра + подписи на зуме, центр подсвечен. Два режима:
   - local: эго-граф вокруг заметки (мгновенно, без кэша);
   - full: полный граф по кнопке. Раскладку считает КЛИЕНТ (force-симуляция),
     координаты кэшируются на бэке (buildGraph); при наличии кэша рисуем сразу.
   Либа react-force-graph-2d (canvas — лёгкая для Telegram WebView). */
import { useEffect, useRef, useState, useCallback, useMemo, cloneElement } from "react";
import ForceGraph2D from "react-force-graph-2d";
import { Icons } from "../components/ds/icons";
import { api } from "../lib/api";
import { graphDataOf, type ForceGraphData } from "../lib/adapters";

/** Узел force-graph + динамические координаты, которые дорисовывает либа. */
type FGNode = ForceGraphData["nodes"][number] & {
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
};

/** Цвет узла по типу заметки (как типизированные аватары в ленте). Sage-семья. */
const TYPE_COLOR: Record<string, string> = {
  action: "#C08A5E", // задача — глина
  thought: "#6E93B8", // идея — синий
  content: "#7A9C7A", // контент — sage
  reference: "#A88BA8", // референс — мов
};
const CENTER_COLOR = "#3C5A3C";
const DEFAULT_NODE_COLOR = "#9DBE9D";
function nodeColor(n: FGNode): string {
  if (n.isCenter) return CENTER_COLOR;
  return (n.type && TYPE_COLOR[n.type]) || DEFAULT_NODE_COLOR;
}
function nodeRadius(n: FGNode): number {
  if (n.isCenter) return 7;
  return 2.6 + Math.min(6, n.degree * 0.7); // хабы крупнее, одиночки мелкие
}

type FullState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "ready"; data: ForceGraphData; needsSave: boolean; stale: boolean }
  | { phase: "error" };

const navBtn = {
  background: "var(--surface-glass-strong)",
  border: "1px solid var(--border-1)",
  width: 36,
  height: 36,
  borderRadius: "50%",
  color: "var(--fg-1)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
} as const;

const primaryBtn = {
  padding: "12px 22px",
  borderRadius: 14,
  background: "var(--brand-primary)",
  color: "var(--fg-on-brand)",
  border: "none",
  fontFamily: "var(--font-ui)",
  fontSize: 14.5,
  fontWeight: 500,
  cursor: "pointer",
} as const;

const linkBtn = {
  background: "transparent",
  border: "none",
  padding: "2px 0",
  color: "var(--brand-primary)",
  fontFamily: "var(--font-ui)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
} as const;

export function GraphScreen({
  mode,
  centerId,
  onBack,
  onOpenNote,
}: {
  mode: "local" | "full";
  centerId?: string | null;
  onBack?: () => void;
  onOpenNote: (id: string) => void;
}) {
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const roRef = useRef<ResizeObserver | null>(null);
  // Callback-ref, А НЕ useRef+useEffect([]): контейнер графа рендерится УСЛОВНО (только
  // после «Построить граф» / загрузки local). useEffect([]) мерил бы ref на маунте, когда
  // div ещё нет → dims остаются {0,0} → ForceGraph2D (гейт dims.w>0) не рисуется (пустой
  // экран — баг из ревью на устройстве). Callback-ref срабатывает ровно когда div появляется.
  const wrapCb = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) return;
    const measure = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    roRef.current = ro;
  }, []);

  // ── local (эго-граф вокруг заметки) ──
  const [local, setLocal] = useState<ForceGraphData | null>(null);
  useEffect(() => {
    if (mode !== "local" || !centerId) return;
    let alive = true;
    api
      .getGraphLocal(centerId, 2)
      .then((g) => alive && setLocal(graphDataOf(g.nodes, g.edges, centerId)))
      .catch(() => alive && setLocal({ nodes: [], links: [] }));
    return () => {
      alive = false;
    };
  }, [mode, centerId]);

  // ── full (полный граф по кнопке + кэш раскладки) ──
  const [full, setFull] = useState<FullState>({ phase: "idle" });
  const buildFull = useCallback(async () => {
    setFull({ phase: "loading" });
    try {
      const g = await api.getGraph();
      const data = graphDataOf(g.nodes, g.edges);
      const cached = !!g.layout && !g.stale;
      if (cached && g.layout) {
        const pos = new Map(g.layout.map((p) => [p.id, p]));
        for (const n of data.nodes as FGNode[]) {
          const p = pos.get(n.id);
          if (p) {
            n.fx = p.x;
            n.fy = p.y;
            n.x = p.x;
            n.y = p.y;
          }
        }
      }
      setFull({ phase: "ready", data, needsSave: !cached, stale: g.stale });
    } catch {
      setFull({ phase: "error" });
    }
  }, []);

  const data: ForceGraphData | null =
    mode === "local" ? local : full.phase === "ready" ? full.data : null;
  const loading =
    (mode === "full" && full.phase === "loading") || (mode === "local" && !!centerId && !local);

  // ── Интерактив: фокус на узле (тап → подсветка, повторный тап → открыть заметку) ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  useEffect(() => setFocusedId(null), [data]); // сброс фокуса при смене данных

  // Соседи сфокусированного узла (для подсветки). Либа мутирует source/target в объекты.
  const idOf = (e: unknown): string =>
    typeof e === "object" && e ? (e as FGNode).id : (e as string);
  const neighbors = useMemo(() => {
    const s = new Set<string>();
    if (!focusedId || !data) return s;
    for (const l of data.links as { source: unknown; target: unknown }[]) {
      const a = idOf(l.source);
      const b = idOf(l.target);
      if (a === focusedId) s.add(b);
      else if (b === focusedId) s.add(a);
    }
    return s;
  }, [focusedId, data]);

  const handleNodeClick = useCallback(
    (node: FGNode) => {
      if (focusedId === node.id) onOpenNote(node.id); // повторный тап — открыть
      else setFocusedId(node.id); // первый тап — фокус (подсветка + подпись)
    },
    [focusedId, onOpenNote],
  );

  // Сохранение раскладки (full) + авто-вписывание графа в экран после стабилизации.
  const handleEngineStop = useCallback(() => {
    fgRef.current?.zoomToFit(400, 36);
    setFull((s) => {
      if (s.phase !== "ready" || !s.needsSave) return s;
      const allNodes = s.data.nodes as FGNode[];
      const coords = allNodes
        .filter((n) => typeof n.x === "number" && typeof n.y === "number")
        .map((n) => ({ id: n.id, x: Math.round(n.x as number), y: Math.round(n.y as number) }));
      // #2 (ревью): сохраняем только ПОЛНУЮ раскладку (частичная роняет узлы в origin).
      if (allNodes.length === 0 || coords.length < allNodes.length) return s;
      // #4 (ревью): после сохранения снимаем stale — баннер «устарел» уходит.
      api
        .buildGraph(coords)
        .then(() => setFull((cur) => (cur.phase === "ready" ? { ...cur, stale: false } : cur)))
        .catch(() => {});
      return { ...s, needsSave: false };
    });
  }, []);

  // Развести узлы пошире (тесные кластеры) — тюним d3-силы после маунта графа.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !data || dims.w === 0) return;
    fg.d3Force?.("charge")?.strength(-60);
    fg.d3Force?.("link")?.distance(38);
    fg.d3ReheatSimulation?.();
  }, [data, dims.w]);

  const drawNode = useCallback(
    (node: FGNode, ctx: CanvasRenderingContext2D, scale: number) => {
      const dimmed = !!focusedId && node.id !== focusedId && !neighbors.has(node.id);
      const r = nodeRadius(node);
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      ctx.globalAlpha = dimmed ? 0.18 : 1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = nodeColor(node);
      ctx.fill();
      if (node.id === focusedId) {
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = CENTER_COLOR;
        ctx.stroke();
      }
      // Подпись: центр / фокус / сосед — всегда; остальные — на достаточном зуме.
      const labelOn = node.isCenter || node.id === focusedId || neighbors.has(node.id) || scale > 0.85;
      if (labelOn && !dimmed) {
        const label = node.name.length > 22 ? `${node.name.slice(0, 22)}…` : node.name;
        ctx.font = `${node.isCenter || node.id === focusedId ? 5.5 : 4.2}px Onest, sans-serif`;
        ctx.fillStyle = "rgba(40,32,24,0.8)";
        ctx.textAlign = "center";
        ctx.fillText(label, x, y + r + 5.5);
      }
      ctx.globalAlpha = 1;
    },
    [focusedId, neighbors],
  );

  const linkColor = useCallback(
    (l: { source: unknown; target: unknown }) => {
      if (!focusedId) return "rgba(122,156,122,0.32)";
      const on = idOf(l.source) === focusedId || idOf(l.target) === focusedId;
      return on ? "rgba(90,124,90,0.6)" : "rgba(122,156,122,0.1)";
    },
    [focusedId],
  );

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        paddingTop: "calc(4px + env(safe-area-inset-top,0))",
        // В full-режиме снизу плавающее меню — отступ, чтобы граф не уходил под него.
        paddingBottom: mode === "full" ? "calc(92px + env(safe-area-inset-bottom,0))" : 0,
      }}
    >
      {/* Без заголовка страницы (конвенция приложения — заголовков нет). В локальном
          режиме оставляем только кнопку назад. */}
      {onBack && (
        <div style={{ padding: "0 16px", display: "flex", alignItems: "center", marginBottom: 8 }}>
          <button onClick={onBack} aria-label="назад" style={navBtn}>
            {cloneElement(Icons.back, { size: 16, sw: 1.6 } as never)}
          </button>
        </div>
      )}

      {mode === "full" && full.phase === "ready" && full.stale && (
        <div style={{ margin: "0 16px 8px", padding: "8px 12px", borderRadius: 12, background: "rgba(234,227,207,0.6)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--fg-2)" }}>Граф устарел — есть новые заметки</span>
          <button onClick={buildFull} style={linkBtn}>Обновить</button>
        </div>
      )}

      {mode === "full" && full.phase === "idle" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "0 24px" }}>
          <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 15, color: "var(--fg-3)", textAlign: "center", lineHeight: 1.4 }}>
            Карта смысловых связей между всеми твоими заметками
          </span>
          <button onClick={buildFull} style={primaryBtn}>Построить граф</button>
        </div>
      )}

      {loading && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 14, color: "var(--fg-3)" }}>Строю граф…</span>
        </div>
      )}

      {mode === "full" && full.phase === "error" && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 14, color: "var(--fg-3)" }}>Не удалось построить граф</span>
        </div>
      )}

      {data && data.nodes.length === 0 && !loading && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
          <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 14, color: "var(--fg-3)", textAlign: "center" }}>
            {mode === "local" ? "У этой заметки пока нет связей" : "Связей пока нет"}
          </span>
        </div>
      )}

      {data && data.nodes.length > 0 && (
        <div ref={wrapCb} style={{ flex: 1, minHeight: 0, position: "relative" }}>
          {dims.w > 0 && (
            <ForceGraph2D
              ref={fgRef}
              width={dims.w}
              height={dims.h}
              graphData={data}
              nodeId="id"
              backgroundColor="rgba(0,0,0,0)"
              linkColor={linkColor as never}
              linkWidth={(l) => 0.4 + ((l as { value?: number }).value ?? 0) * 0.8}
              nodeCanvasObject={drawNode as never}
              nodePointerAreaPaint={((node: FGNode, color: string, ctx: CanvasRenderingContext2D) => {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(node.x ?? 0, node.y ?? 0, nodeRadius(node) + 3, 0, 2 * Math.PI);
                ctx.fill();
              }) as never}
              onNodeClick={handleNodeClick as never}
              onBackgroundClick={() => setFocusedId(null)}
              onEngineStop={handleEngineStop}
            />
          )}
        </div>
      )}
    </div>
  );
}
