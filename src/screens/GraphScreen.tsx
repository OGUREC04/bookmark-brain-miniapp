/* GraphScreen — граф связей (Connections Phase 5A). Реф — Obsidian Graph view.
   Два режима:
   - local: эго-граф вокруг заметки (мгновенно, без кэша);
   - full: полный граф. Раскладку считает КЛИЕНТ (force-симуляция), координаты
     кэшируются на бэке (buildGraph); при наличии кэша рисуем сразу.
   Либа react-force-graph-2d (canvas — лёгкая для Telegram WebView).

   Визуал (по рефам Obsidian + правкам пользователя):
   - цвет узла = тип заметки; «прочее» — нейтральный серый (не сливается с зелёным);
   - хабы (топ по связям) подписаны ВСЕГДА → граф читается на общем плане;
   - мягкое свечение + лёгкая обводка узлов, изогнутые рёбра → меньше «топорности»;
   - тап по узлу → карточка-превью (название + «открыть»), без «тап-тап»;
   - легенда+счётчик+тогл одиночек — в ОДНОЙ нижней панели; легенда = фильтр (тап = подсветка);
   - кнопки «вписать» нет: авто-вписывание при входе + двойной тап по фону. */
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

/** Цвет узла по типу заметки. Типы отчётливо разные; «прочее» — тёплый СЕРЫЙ
    (был светло-зелёный #9DBE9D — сливался с «контентом»). */
const TYPE_COLOR: Record<string, string> = {
  action: "#C08A5E", // задача — глина
  thought: "#6E93B8", // идея — синий
  content: "#7A9C7A", // контент — sage
  reference: "#A88BA8", // референс — мов
};
const CENTER_COLOR = "#3C5A3C";
const DEFAULT_NODE_COLOR = "#ADA69A"; // прочее — нейтральный тёплый серый
/** Легенда: тип → подпись + цвет (порядок показа). */
const LEGEND: [type: string, label: string, color: string][] = [
  ["action", "Задача", TYPE_COLOR.action],
  ["thought", "Идея", TYPE_COLOR.thought],
  ["content", "Контент", TYPE_COLOR.content],
  ["reference", "Референс", TYPE_COLOR.reference],
  ["__other", "Прочее", DEFAULT_NODE_COLOR],
];
const HUB_LABEL_COUNT = 7; // сколько самых связанных узлов подписывать всегда
function typeKey(n: FGNode): string {
  return n.type && TYPE_COLOR[n.type] ? n.type : "__other";
}
function typeLabel(n: FGNode): string {
  return LEGEND.find(([t]) => t === typeKey(n))?.[1] ?? "заметка";
}
function nodeColor(n: FGNode): string {
  if (n.isCenter) return CENTER_COLOR;
  return (n.type && TYPE_COLOR[n.type]) || DEFAULT_NODE_COLOR;
}
function nodeRadius(n: FGNode): number {
  if (n.isCenter) return 7.5;
  return 3.2 + Math.min(6.5, n.degree * 0.75); // хабы крупнее, одиночки мелкие
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
  // Callback-ref, А НЕ useRef+useEffect([]): контейнер графа рендерится УСЛОВНО (после
  // загрузки). useEffect([]) мерил бы ref на маунте, когда div ещё нет → dims {0,0} →
  // ForceGraph2D (гейт dims.w>0) не рисуется. Callback-ref срабатывает когда div появляется.
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
  const buildFull = useCallback(async (manual = false) => {
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
      // manual = пользователь явно нажал «Обновить граф» → баннер «появились новые
      // связи» больше не нужен (данные только что перезагружены; раскладка
      // досохранится в handleEngineStop). Авто-загрузка уважает реальный g.stale.
      setFull({ phase: "ready", data, needsSave: !cached, stale: manual ? false : g.stale });
    } catch {
      setFull({ phase: "error" });
    }
  }, []);

  // Авто-загрузка при входе на таб. Раскладка кэшируется на бэке → повторный заход быстрый.
  useEffect(() => {
    if (mode === "full" && full.phase === "idle") buildFull();
  }, [mode, full.phase, buildFull]);

  const data: ForceGraphData | null =
    mode === "local" ? local : full.phase === "ready" ? full.data : null;
  const loading =
    (mode === "full" && (full.phase === "idle" || full.phase === "loading")) ||
    (mode === "local" && !!centerId && !local);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);
  // Прямоугольники уже нарисованных подписей в текущем кадре — анти-наложение
  // (сбрасывается каждый кадр в onRenderFramePre; подпись не рисуется, если
  // пересекается с уже нарисованной — кроме центра/выбранного/ховера).
  const labelRects = useRef<{ x1: number; y1: number; x2: number; y2: number }[]>([]);

  // ── Интерактив ──
  // Выбранный узел (тап) → подсветка соседей + карточка-превью с «открыть».
  const [selected, setSelected] = useState<FGNode | null>(null);
  // Подсветка по типу (тап в легенде).
  const [highlightType, setHighlightType] = useState<string | null>(null);
  // Наведение (ховер) — кольцо + подпись на десктопе/превью.
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const focusedId = selected?.id ?? null;
  useEffect(() => {
    setSelected(null);
    setHighlightType(null);
  }, [data]); // сброс при смене данных

  // Соседи выбранного узла (для подсветки). Либа мутирует source/target в объекты.
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

  const handleNodeClick = useCallback((node: FGNode) => {
    setSelected(node); // фокус + карточка-превью; «открыть» — в карточке
    setHighlightType(null);
  }, []);

  // Двойной тап по фону = вписать; одиночный = снять выбор/подсветку.
  const lastBgTap = useRef(0);
  const handleBackgroundClick = useCallback(() => {
    const now = performance.now();
    if (now - lastBgTap.current < 300) {
      fgRef.current?.zoomToFit?.(420, 48);
      lastBgTap.current = 0;
      return;
    }
    lastBgTap.current = now;
    setSelected(null);
    setHighlightType(null);
  }, []);

  // Сироты (узлы без связей) загромождают граф и создают ощущение «не полного».
  // По умолчанию прячем; показываем счётчиком-тоглом.
  const [showOrphans, setShowOrphans] = useState(false);
  const orphanCount = useMemo(
    () => (data ? data.nodes.filter((n) => n.degree === 0 && !n.isCenter).length : 0),
    [data],
  );
  const gdata = useMemo<ForceGraphData | null>(() => {
    if (!data) return null;
    if (showOrphans || orphanCount === 0) return data;
    return { nodes: data.nodes.filter((n) => n.degree > 0 || n.isCenter), links: data.links };
  }, [data, showOrphans, orphanCount]);
  const edgeCount = data?.links.length ?? 0;

  // Хабы — топ по числу связей, подписаны всегда (граф читается на общем плане).
  const hubIds = useMemo(() => {
    const s = new Set<string>();
    if (!gdata) return s;
    const sorted = [...gdata.nodes].filter((n) => !n.isCenter && n.degree > 0).sort((a, b) => b.degree - a.degree);
    for (let i = 0; i < Math.min(HUB_LABEL_COUNT, sorted.length); i++) s.add(sorted[i].id);
    return s;
  }, [gdata]);

  // Какие типы реально есть в графе — для легенды (не показываем лишние цвета).
  const presentTypes = useMemo(() => {
    const s = new Set<string>();
    for (const n of gdata?.nodes ?? []) s.add(typeKey(n));
    return s;
  }, [gdata]);

  // Сохранение раскладки (full) + авто-вписывание после стабилизации.
  const handleEngineStop = useCallback(() => {
    fgRef.current?.zoomToFit?.(420, 48);
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

  // Тюним d3-силы (Obsidian/Cambridge): отталкивание с потолком + длина ребра по
  // похожести → читаемые кластеры. Каскад вписываний: симуляция оседает не сразу.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !gdata || dims.w === 0) return;
    const charge = fg.d3Force?.("charge");
    charge?.strength?.(-150);
    charge?.distanceMax?.(360);
    const link = fg.d3Force?.("link");
    link?.distance?.((l: { value?: number }) => 50 + (1 - (l.value ?? 0)) * 50);
    link?.strength?.(0.35);
    fg.d3ReheatSimulation?.();
    const ts = [350, 900, 1800, 3000].map((d) => setTimeout(() => fg.zoomToFit?.(420, 48), d));
    return () => ts.forEach(clearTimeout);
  }, [gdata, dims.w]);

  const drawNode = useCallback(
    (node: FGNode, ctx: CanvasRenderingContext2D, scale: number) => {
      const dimByFocus = !!focusedId && node.id !== focusedId && !neighbors.has(node.id);
      const dimByType = !!highlightType && typeKey(node) !== highlightType && !node.isCenter;
      const dimmed = dimByFocus || dimByType;
      const r = nodeRadius(node);
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const color = nodeColor(node);
      // Мягкое свечение (halo) — глубина без «топорности».
      ctx.globalAlpha = dimmed ? 0.04 : 0.16;
      ctx.beginPath();
      ctx.arc(x, y, r + 2.4, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      // Тело узла.
      ctx.globalAlpha = dimmed ? 0.16 : 1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      // Тонкая светлая обводка — аккуратность.
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.stroke();
      // Кольцо на выбранном узле.
      if (node.id === focusedId) {
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = CENTER_COLOR;
        ctx.beginPath();
        ctx.arc(x, y, r + 1.8, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (node.id === hoveredId && !dimmed) {
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = "rgba(122,156,122,0.75)";
        ctx.beginPath();
        ctx.arc(x, y, r + 1.8, 0, 2 * Math.PI);
        ctx.stroke();
      }
      // Подпись: центр / выбранный / ховер / сосед / хаб — всегда; остальные — на зуме.
      const labelOn =
        node.isCenter || node.id === focusedId || node.id === hoveredId || neighbors.has(node.id) || hubIds.has(node.id) || scale > 1.1;
      if (labelOn && !dimmed) {
        const label = node.name.length > 16 ? `${node.name.slice(0, 16)}…` : node.name;
        const fontPx = node.isCenter || node.id === focusedId ? 5.5 : 4.2;
        ctx.font = `${fontPx}px Onest, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const ly = y + r + 2.5;
        const tw = ctx.measureText(label).width;
        const rect = { x1: x - tw / 2 - 1.5, y1: ly - 0.5, x2: x + tw / 2 + 1.5, y2: ly + fontPx + 1.5 };
        // Центр/выбранный/ховер — подпись всегда; остальные — только если не наезжает.
        const priority = node.isCenter || node.id === focusedId || node.id === hoveredId;
        const overlaps = labelRects.current.some(
          (q) => rect.x1 < q.x2 && rect.x2 > q.x1 && rect.y1 < q.y2 && rect.y2 > q.y1,
        );
        if (priority || !overlaps) {
          labelRects.current.push(rect);
          ctx.globalAlpha = 1;
          ctx.fillStyle = "rgba(245,241,230,0.82)"; // halo-плашка под текстом
          ctx.fillRect(rect.x1, rect.y1, tw + 3, fontPx + 1.5);
          ctx.fillStyle = "rgba(40,32,24,0.85)";
          ctx.fillText(label, x, ly);
        }
        ctx.textBaseline = "alphabetic";
      }
      ctx.globalAlpha = 1;
    },
    [focusedId, hoveredId, neighbors, highlightType, hubIds],
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
        paddingBottom: mode === "full" ? "calc(92px + env(safe-area-inset-bottom,0))" : 0,
      }}
    >
      {/* Без заголовка (конвенция приложения). В локальном режиме — только «назад». */}
      {onBack && (
        <div style={{ padding: "0 16px", display: "flex", alignItems: "center", marginBottom: 8 }}>
          <button onClick={onBack} aria-label="назад" style={navBtn}>
            {cloneElement(Icons.back, { size: 16, sw: 1.6 } as never)}
          </button>
        </div>
      )}

      {mode === "full" && full.phase === "ready" && full.stale && (
        <div style={{ margin: "0 16px 10px", display: "flex", justifyContent: "center" }}>
          <button
            onClick={() => buildFull(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "7px 15px",
              borderRadius: 999,
              background: "rgba(122,156,122,0.12)",
              border: "1px solid rgba(122,156,122,0.28)",
              color: "var(--brand-primary)",
              fontFamily: "var(--font-ui)",
              fontSize: 12.5,
              fontWeight: 500,
              letterSpacing: "-0.005em",
              cursor: "pointer",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            Обновить граф · появились новые связи
          </button>
        </div>
      )}

      {loading && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 14, color: "var(--fg-3)" }}>Строю граф…</span>
        </div>
      )}

      {mode === "full" && full.phase === "error" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "0 24px" }}>
          <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 14, color: "var(--fg-3)" }}>Не удалось построить граф</span>
          <button onClick={() => buildFull()} style={primaryBtn}>Повторить</button>
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
        <div ref={wrapCb} style={{ flex: 1, minHeight: 0, position: "relative", animation: "graphIn 0.45s ease both" }}>
          {dims.w > 0 && (
            <ForceGraph2D
              ref={fgRef}
              width={dims.w}
              height={dims.h}
              graphData={gdata ?? data}
              nodeId="id"
              backgroundColor="rgba(0,0,0,0)"
              // Без встроенного тултипа: название показывает нижняя плашка-превью.
              nodeLabel={(() => "") as never}
              onRenderFramePre={() => { labelRects.current = []; }}
              enableNodeDrag={false}
              minZoom={0.3}
              maxZoom={8}
              d3VelocityDecay={0.5}
              warmupTicks={80}
              cooldownTicks={120}
              linkColor={linkColor as never}
              linkCurvature={0.16}
              linkWidth={(l) => 0.4 + ((l as { value?: number }).value ?? 0) * 0.8}
              nodeCanvasObject={drawNode as never}
              nodePointerAreaPaint={((node: FGNode, color: string, ctx: CanvasRenderingContext2D) => {
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(node.x ?? 0, node.y ?? 0, nodeRadius(node) + 3, 0, 2 * Math.PI);
                ctx.fill();
              }) as never}
              onNodeHover={((n: FGNode | null) => setHoveredId(n?.id ?? null)) as never}
              onNodeClick={handleNodeClick as never}
              onBackgroundClick={handleBackgroundClick}
              onEngineStop={handleEngineStop}
            />
          )}

          {/* нижний стек: карточка-превью (если выбран узел) НАД единой панелью */}
          <div
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              bottom: mode === "full" ? 6 : 12,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              zIndex: 2,
              pointerEvents: "none",
            }}
          >
            {/* Карточка-превью выбранной заметки */}
            {selected && (
              <div
                style={{
                  pointerEvents: "auto",
                  background: "var(--surface-glass-strong)",
                  backdropFilter: "var(--blur-card)",
                  WebkitBackdropFilter: "var(--blur-card)",
                  border: "1px solid var(--border-1)",
                  borderRadius: 16,
                  padding: "12px 14px",
                  boxShadow: "0 6px 18px rgba(60,40,25,0.08)",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: "var(--font-ui)", fontSize: 11.5, color: "var(--fg-3)", letterSpacing: "-0.005em", marginBottom: 2 }}>
                    {typeLabel(selected)}
                  </div>
                  <div style={{ fontFamily: "var(--font-ui)", fontSize: 14.5, fontWeight: 500, color: "var(--fg-1)", letterSpacing: "-0.01em", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {selected.name}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenNote(selected.id)}
                  aria-label="Открыть заметку"
                  style={{
                    flexShrink: 0,
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "var(--brand-primary)",
                    color: "var(--fg-on-brand)",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  {cloneElement(Icons.arrow, { size: 17, sw: 2 } as never)}
                </button>
              </div>
            )}

            {/* Единая панель: легенда (фильтр) + счётчик + тогл одиночек */}
            <div
              style={{
                pointerEvents: "auto",
                background: "var(--surface-glass-strong)",
                backdropFilter: "var(--blur-chip)",
                WebkitBackdropFilter: "var(--blur-chip)",
                border: "1px solid var(--border-1)",
                borderRadius: 14,
                padding: "8px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 7,
              }}
            >
              {/* легенда-фильтр: тап по типу = подсветить такие узлы */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 10px" }}>
                {LEGEND.filter(([t]) => presentTypes.has(t)).map(([t, label, color]) => {
                  const active = highlightType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setHighlightType((h) => (h === t ? null : t))}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        border: "none",
                        background: "transparent",
                        padding: "1px 2px",
                        cursor: "pointer",
                        opacity: highlightType && !active ? 0.4 : 1,
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
                      <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, fontWeight: active ? 600 : 400, color: "var(--fg-3)", letterSpacing: "-0.005em" }}>
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {/* счётчик + тогл одиночек */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-3)", letterSpacing: "-0.005em" }}>
                  {gdata?.nodes.length ?? 0} заметок · {edgeCount} связей
                </span>
                {orphanCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowOrphans((v) => !v)}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      color: "var(--brand-primary)",
                      fontFamily: "var(--font-ui)",
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: "pointer",
                      WebkitTapHighlightColor: "transparent",
                    }}
                  >
                    {showOrphans ? "скрыть одиночные" : `+${orphanCount} без связей`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
