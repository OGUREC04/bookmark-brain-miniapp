/* Bottom Nav v2 — floating frosted pill, 3 equal grid cells (icon + always-on
   label), active = tight sage-tint capsule around icon+label (NOT a stretching
   pill) + separate sage FAB. Spec: docs reference patches/navbar_v2/README.md.
   position:fixed + safe-area (our app scrolls full-height; absolute regresses
   the content-under-nav bug). */
import { cloneElement } from "react";
import { Icons, ExtraIcons } from "./icons";

export type NavTab = "mysli" | "spaces" | "graph" | "me";

type TabDef = { id: NavTab; label: string; icon: React.ReactElement };

const MYSLI: TabDef = { id: "mysli", label: "Мысли", icon: ExtraIcons.thoughts };
const SPACES: TabDef = { id: "spaces", label: "Пространства", icon: ExtraIcons.spaces };
const GRAPH: TabDef = { id: "graph", label: "Граф", icon: Icons.graph };
const ME: TabDef = { id: "me", label: "Я", icon: Icons.user };

// Таб «Граф» виден только при включённых связях (showGraph) — флаг знает App,
// ds-слой его не импортит.
const tabsBase: TabDef[] = [MYSLI, SPACES, ME];
const tabsWithGraph: TabDef[] = [MYSLI, SPACES, GRAPH, ME];

/** Иконка-таб без подписи (Instagram-стиль): активная — акцент + жирнее. */
function NavIcon({ tab, active, onClick }: { tab: TabDef; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={tab.label}
      aria-current={active ? "page" : undefined}
      style={{
        flex: 1,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 50,
        padding: 0,
        color: active ? "var(--brand-primary)" : "var(--fg-3)",
        transition: "color 200ms var(--ease-out)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {cloneElement(tab.icon, { size: 25, sw: active ? 2.1 : 1.7 } as never)}
    </button>
  );
}

/** Кнопка «создать» — «+» по центру бара (как create в Instagram). */
function CreateBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="создать"
      style={{
        flex: 1,
        background: "transparent",
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 50,
        padding: 0,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 11,
          background: "var(--brand-primary)",
          color: "var(--fg-on-brand)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 8px rgba(122,156,122,0.35)",
        }}
      >
        {cloneElement(Icons.plus, { size: 20, sw: 2.2 } as never)}
      </span>
    </button>
  );
}

export function BottomNav({
  current,
  onChange,
  onFab,
  showGraph = false,
}: {
  current: NavTab;
  onChange: (t: NavTab) => void;
  onFab: () => void;
  /** Показывать таб «Граф» (FLAGS.CONNECTIONS — знает App). */
  showGraph?: boolean;
}) {
  const tabs = showGraph ? tabsWithGraph : tabsBase;
  // «+» (создать) — по центру бара (Instagram-стиль): слева половина табов, потом +, потом остальные.
  const mid = Math.ceil(tabs.length / 2);
  const left = tabs.slice(0, mid);
  const right = tabs.slice(mid);
  return (
    <nav
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        background: "rgba(255,252,246,0.94)",
        backdropFilter: "blur(24px) saturate(180%)",
        WebkitBackdropFilter: "blur(24px) saturate(180%)",
        borderTop: "1px solid var(--border-1)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        padding: "0 8px",
        paddingBlock: "2px",
      }}
    >
      {left.map((t) => (
        <NavIcon key={t.id} tab={t} active={current === t.id} onClick={() => onChange(t.id)} />
      ))}
      <CreateBtn onClick={onFab} />
      {right.map((t) => (
        <NavIcon key={t.id} tab={t} active={current === t.id} onClick={() => onChange(t.id)} />
      ))}
    </nav>
  );
}
