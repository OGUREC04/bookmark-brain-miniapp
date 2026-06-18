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

// Табы «Пространства»/«Граф» видны только при включённых флагах (showSpaces/
// showGraph) — флаги знает App, ds-слой их не импортит.

/** Иконка-таб без подписи (Instagram-стиль): активная — акцент + жирнее.
    disabled — фича не готова: приглушаем (fg-4), вешаем бейдж «Скоро», тап не переключает (даёт хинт). */
function NavIcon({
  tab,
  active,
  disabled = false,
  badge,
  onClick,
}: {
  tab: TabDef;
  active: boolean;
  disabled?: boolean;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={disabled ? `${tab.label} — скоро` : tab.label}
      aria-current={active ? "page" : undefined}
      aria-disabled={disabled || undefined}
      style={{
        position: "relative",
        flex: 1,
        background: "transparent",
        border: "none",
        cursor: disabled ? "default" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 50,
        padding: 0,
        color: disabled ? "var(--fg-4)" : active ? "var(--brand-primary)" : "var(--fg-3)",
        transition: "color 200ms var(--ease-out)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {cloneElement(tab.icon, { size: 24, sw: active ? 1.8 : 1.5 } as never)}
      {badge && (
        <span
          style={{
            position: "absolute",
            top: 2,
            left: "50%",
            transform: "translateX(-50%)",
            padding: "1px 5px",
            borderRadius: 999,
            background: "var(--brand-primary)",
            color: "var(--fg-on-brand)",
            fontFamily: "var(--font-ui)",
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "-0.005em",
            lineHeight: 1.45,
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          {badge}
        </span>
      )}
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
        {cloneElement(Icons.plus, { size: 20, sw: 2 } as never)}
      </span>
    </button>
  );
}

export function BottomNav({
  current,
  onChange,
  onFab,
  onLocked,
  showGraph = false,
  showSpaces = false,
}: {
  current: NavTab;
  onChange: (t: NavTab) => void;
  onFab: () => void;
  /** Тап по выключенному табу (фича не готова) — показать хинт «скоро». */
  onLocked?: () => void;
  /** Показывать таб «Граф» (FLAGS.CONNECTIONS — знает App). */
  showGraph?: boolean;
  /** «Пространства» включены (FLAGS.SPACES — знает App). Если нет — таб виден, но disabled + «Скоро». */
  showSpaces?: boolean;
}) {
  // «Пространства» показываем ВСЕГДА; пока фича не готова (showSpaces=false) — disabled + бейдж «Скоро».
  // «Граф» — скрыт целиком, пока выключен (showGraph).
  const items: { tab: TabDef; disabled: boolean }[] = [
    { tab: MYSLI, disabled: false },
    { tab: SPACES, disabled: !showSpaces },
    ...(showGraph ? [{ tab: GRAPH, disabled: false }] : []),
    { tab: ME, disabled: false },
  ];
  // «+» (создать) — по центру бара (Instagram-стиль): слева половина табов, потом +, потом остальные.
  const mid = Math.ceil(items.length / 2);
  const left = items.slice(0, mid);
  const right = items.slice(mid);
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
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        // padding ПЕРВЫМ, paddingBottom ПОСЛЕ — иначе shorthand затирает safe-area
        // (был баг: навбар прилипал к низу, env(safe-area) игнорировался).
        padding: "6px 8px",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)",
      }}
    >
      {left.map(({ tab, disabled }) => (
        <NavIcon
          key={tab.id}
          tab={tab}
          active={current === tab.id}
          disabled={disabled}
          badge={disabled ? "Скоро" : undefined}
          onClick={() => (disabled ? onLocked?.() : onChange(tab.id))}
        />
      ))}
      <CreateBtn onClick={onFab} />
      {right.map(({ tab, disabled }) => (
        <NavIcon
          key={tab.id}
          tab={tab}
          active={current === tab.id}
          disabled={disabled}
          badge={disabled ? "Скоро" : undefined}
          onClick={() => (disabled ? onLocked?.() : onChange(tab.id))}
        />
      ))}
    </nav>
  );
}
