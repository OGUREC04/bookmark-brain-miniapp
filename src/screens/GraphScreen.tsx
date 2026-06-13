/* GraphScreen — граф связей (Connections Phase 5A). Реф — Obsidian Graph view:
   точки-узлы + тонкие рёбра + подписи на зуме, центр подсвечен. Два режима:
   - local: эго-граф вокруг заметки (мгновенно, без кэша);
   - full: полный граф по кнопке. Раскладку считает КЛИЕНТ (force-симуляция),
     координаты кэшируются на бэке (buildGraph); при наличии кэша рисуем сразу.
   Либа react-force-graph-2d (canvas — лёгкая для Telegram WebView). */
import { useEffect, useRef, useState, useCallback, cloneElement } from "react";
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
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
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

  // Раскладку (если считали клиентом) сохраняем на бэк после стабилизации симуляции.
  const onEngineStop = useCallback(() => {
    setFull((s) => {
      if (s.phase !== "ready" || !s.needsSave) return s;
      const coords = (s.data.nodes as FGNode[])
        .filter((n) => typeof n.x === "number" && typeof n.y === "number")
        .map((n) => ({ id: n.id, x: Math.round(n.x as number), y: Math.round(n.y as number) }));
      if (coords.length > 0) api.buildGraph(coords).catch(() => {});
      return { ...s, needsSave: false };
    });
  }, []);

  const drawNode = useCallback(
    (node: FGNode, ctx: CanvasRenderingContext2D, scale: number) => {
      const r = node.isCenter ? 6 : 3.5;
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI);
      ctx.fillStyle = node.isCenter ? "#5A7C5A" : "#9DBE9D";
      ctx.fill();
      if (scale > 1.3 || node.isCenter) {
        const label = node.name.length > 22 ? `${node.name.slice(0, 22)}…` : node.name;
        ctx.font = `${node.isCenter ? 5 : 4}px Onest, sans-serif`;
        ctx.fillStyle = "rgba(40,32,24,0.72)";
        ctx.textAlign = "center";
        ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + r + 5);
      }
    },
    [],
  );

  const data: ForceGraphData | null =
    mode === "local" ? local : full.phase === "ready" ? full.data : null;
  const loading = (mode === "full" && full.phase === "loading") || (mode === "local" && !local);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", paddingTop: "calc(4px + env(safe-area-inset-top,0))" }}>
      <div style={{ padding: "0 16px", display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        {onBack && (
          <button onClick={onBack} aria-label="назад" style={navBtn}>
            {cloneElement(Icons.back, { size: 16, sw: 1.6 } as never)}
          </button>
        )}
        <h1 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 500, fontSize: 22, color: "var(--fg-1)", margin: 0, letterSpacing: "-0.01em" }}>
          {mode === "local" ? "Связи заметки" : "Граф связей"}
        </h1>
      </div>

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
        <div ref={wrapRef} style={{ flex: 1, minHeight: 0, position: "relative" }}>
          {dims.w > 0 && (
            <ForceGraph2D
              width={dims.w}
              height={dims.h}
              graphData={data}
              nodeId="id"
              backgroundColor="rgba(0,0,0,0)"
              linkColor={() => "rgba(122,156,122,0.32)"}
              linkWidth={(l) => 0.4 + ((l as { value?: number }).value ?? 0) * 0.8}
              nodeCanvasObject={drawNode as never}
              nodePointerAreaPaint={((node: FGNode, color: string, ctx: CanvasRenderingContext2D) => {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(node.x ?? 0, node.y ?? 0, node.isCenter ? 9 : 7, 0, 2 * Math.PI);
                ctx.fill();
              }) as never}
              onNodeClick={((node: FGNode) => onOpenNote(node.id)) as never}
              onEngineStop={onEngineStop}
            />
          )}
        </div>
      )}
    </div>
  );
}
