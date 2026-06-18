/* ЭКРАН 1 — Мысли. Ported 1:1 from docs/design-system-miniapp/app/Mysli.jsx,
   wired to the real bookmarks API via adapters. */
import { useEffect, useState, cloneElement } from "react";
import { Icons, ExtraIcons } from "../components/ds/icons";
import { Glyph, SearchBar, EmptyState } from "../components/ds/atoms";
import { ChatRow, DaySeparator } from "../components/ds/ChatRow";
import { BookmarkCard } from "../components/ds/BookmarkCard";
import { SuggestionPager } from "../components/ds/SuggestionPager";
import { api, type Bookmark } from "../lib/api";
import { bookmarkToChatRow, bookmarkToCard, matchesFilter } from "../lib/adapters";
import { formatDaySeparator } from "../lib/formatters";
import { getUserInfo } from "../lib/telegram";

type Filter = "all" | "fav" | "task" | "voice";

function BellPillCompact({ count = 0, onClick }: { count?: number; onClick?: () => void }) {
  const has = count > 0;
  return (
    <button
      onClick={onClick}
      aria-label="напоминания"
      style={{
        position: "relative",
        background: has ? "var(--brand-primary-tint)" : "var(--surface-glass)",
        border: has ? "1px solid rgba(122,156,122,0.35)" : "1px solid var(--border-1)",
        // квадрат той же высоты, что строка поиска (56)
        width: 56,
        height: 56,
        borderRadius: "var(--radius-chip)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: has ? "var(--brand-primary-press)" : "var(--fg-2)",
        flexShrink: 0,
        boxShadow: "var(--shadow-glass-card)",
        transition: "all 200ms var(--ease-out)",
      }}
    >
      {cloneElement(ExtraIcons.bell, { size: 19, sw: 1.7 } as never)}
      {has && (
        <span
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            minWidth: 19,
            height: 19,
            padding: "0 5px",
            borderRadius: 999,
            background: "var(--brand-primary)",
            color: "var(--fg-on-brand)",
            fontFamily: "var(--font-ui)",
            fontSize: 11,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid var(--bg-page)",
            lineHeight: 1,
            boxSizing: "border-box",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function FilterChips({
  active,
  onChange,
  counts,
}: {
  active: Filter;
  onChange: (f: Filter) => void;
  counts: Record<Filter, number>;
}) {
  const items: { id: Filter; label: string; glyph?: string }[] = [
    { id: "all", label: "Все" },
    { id: "fav", glyph: "★", label: "" },
    { id: "task", label: "Задачи" },
    { id: "voice", label: "Голос" },
  ];
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        gap: 6,
        overflowX: "auto",
        overflowY: "visible",
        padding: "6px 0",
        margin: "-6px 0",
        scrollbarWidth: "none",
      }}
    >
      {items.map((it) => {
        const on = active === it.id;
        const c = counts[it.id];
        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            style={{
              flexShrink: 0,
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "7px 14px",
              borderRadius: 999,
              fontFamily: "var(--font-ui)",
              fontSize: 12.5,
              fontWeight: on ? 600 : 500,
              letterSpacing: "-0.005em",
              background: on ? "var(--brand-primary)" : "var(--surface-glass)",
              color: on ? "var(--fg-on-brand)" : "var(--fg-2)",
              border: on ? "1px solid transparent" : "1px solid var(--border-1)",
              backdropFilter: on ? "none" : "var(--blur-chip)",
              WebkitBackdropFilter: on ? "none" : "var(--blur-chip)",
              boxShadow: on ? "0 1px 3px rgba(122,156,122,0.20)" : "none",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {it.glyph && <Glyph ch={it.glyph} size={13} color={on ? "currentColor" : "var(--brand-primary)"} />}
            {it.label}
            {it.id !== "fav" && c > 0 && (
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, opacity: 0.7, fontWeight: 500 }}>{c}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ViewSegment({ view, setView }: { view: "chat" | "cards"; setView: (v: "chat" | "cards") => void }) {
  const btn = (id: "chat" | "cards", icon: React.ReactElement) => {
    const on = view === id;
    return (
      <button
        onClick={() => setView(id)}
        aria-label={id}
        aria-pressed={on}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 28,
          borderRadius: 999,
          cursor: "pointer",
          background: on ? "var(--surface-glass-strong)" : "transparent",
          border: on ? "1px solid var(--glass-edge)" : "1px solid transparent",
          color: on ? "var(--fg-1)" : "var(--fg-3)",
          boxShadow: on ? "var(--shadow-glass-chip)" : "none",
        }}
      >
        {cloneElement(icon, { size: 15, sw: 1.6 } as never)}
      </button>
    );
  };
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 2,
        padding: 3,
        background: "rgba(234,227,207,0.4)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: 999,
        flexShrink: 0,
      }}
    >
      {btn("chat", Icons.feed)}
      {btn("cards", Icons.cards)}
    </div>
  );
}

// Подсказки скрыты до реального источника (bd bookmark-brain-ntn). Вернуть = true.
const SHOW_SUGGESTIONS = false;

// Модульный кеш ленты — чтобы при возврате из заметки не было блика загрузки
// (экран размонтируется/монтируется заново в state-driven навигации).
// Ключуется по telegram user id — иначе при смене аккаунта (multi-account / dev)
// кеш юзера A мелькнёт юзеру B до первого рефетча.
let feedCache: { userId: string; items: Bookmark[]; reminderCount: number } | null = null;

function currentUserId(): string {
  return getUserInfo()?.id?.toString() ?? "";
}

const SUGGESTION_DEMO = [
  {
    text: (
      <>
        3 закладки про rlhf — собрать в{" "}
        <b style={{ fontFamily: "var(--font-ui)", fontStyle: "normal", fontWeight: 500, color: "var(--brand-primary)" }}>
          «alignment»
        </b>
        ?
      </>
    ),
    sources: [
      { letter: "A", tone: "sage" as const, domain: "anthropic" },
      { letter: "O", tone: "slate" as const, domain: "openai" },
      { letter: "K", tone: "honey" as const, domain: "x.com" },
    ],
  },
  {
    text: (
      <>
        год назад ты сохранил{" "}
        <b style={{ fontFamily: "var(--font-ui)", fontStyle: "normal", fontWeight: 500, color: "var(--fg-1)" }}>
          «scaling laws»
        </b>{" "}
        — открыть?
      </>
    ),
    sources: [{ letter: "S", tone: "plum" as const, domain: "arxiv.org" }],
    meta: "11 месяцев в очереди",
  },
];

export function MysliScreen({
  reloadKey,
  onSearch,
  onBell,
  onMore,
  onOpen,
}: {
  reloadKey: number;
  onSearch: () => void;
  onBell: () => void;
  onMore: (b: Bookmark) => void;
  onOpen: (b: Bookmark) => void;
}) {
  const [view, setView] = useState<"chat" | "cards">("chat");
  const [filter, setFilter] = useState<Filter>("all");
  const [hideSuggest, setHideSuggest] = useState(false);
  // кеш валиден только для текущего юзера (иначе мелькнёт чужая лента при смене аккаунта)
  const cache = feedCache?.userId === currentUserId() ? feedCache : null;
  const [items, setItems] = useState<Bookmark[]>(() => cache?.items ?? []);
  const [reminderCount, setReminderCount] = useState(() => cache?.reminderCount ?? 0);
  // спиннер только на самом первом заходе (кеша ещё нет); возврат/рефетч — без блика
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [list, rem] = await Promise.all([
          api.getBookmarks({ perPage: 50, isArchived: false }),
          api.reminders.upcoming(50).catch(() => ({ items: [], total: 0 })),
        ]);
        if (!alive) return;
        setItems(list.items);
        setReminderCount(rem.total);
        feedCache = { userId: currentUserId(), items: list.items, reminderCount: rem.total };
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // refetch on reloadKey bump (after a mutation) without unmount/flash
  }, [reloadKey]);

  const filtered = items.filter((b) => matchesFilter(b, filter));
  const counts: Record<Filter, number> = {
    all: items.length,
    fav: items.filter((b) => matchesFilter(b, "fav")).length,
    task: items.filter((b) => matchesFilter(b, "task")).length,
    voice: items.filter((b) => matchesFilter(b, "voice")).length,
  };

  return (
    <div style={{ padding: "0 0 calc(74px + env(safe-area-inset-bottom, 0px))" }}>
      {/* sticky — поиск + колокольчик. iOS scroll-edge: фон цвета страницы +
          backdrop-blur, оба ЗАТУХАЮТ книзу через mask-градиент → нет жёсткой границы,
          контент уезжает под шапку с плавным фейдом+блюром (как в Telegram).
          pointerEvents:none на контейнере (зона фейда не перехватывает тапы по ленте),
          auto — на строке поиска. */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)",
          paddingBottom: 26,
          pointerEvents: "none",
          background:
            "linear-gradient(to bottom, var(--bg-page) 0%, var(--bg-page) calc(100% - 30px), transparent 100%)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
          maskImage: "linear-gradient(to bottom, #000 0%, #000 calc(100% - 28px), transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, #000 0%, #000 calc(100% - 28px), transparent 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "stretch", gap: 8, padding: "0 16px", pointerEvents: "auto" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <SearchBar onFocus={onSearch} />
          </div>
          <BellPillCompact count={reminderCount} onClick={onBell} />
        </div>
      </div>

      {/* фильтр-чипы + переключатель вида — в обычном потоке (скроллятся) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 16px 14px" }}>
        <FilterChips active={filter} onChange={setFilter} counts={counts} />
        <ViewSegment view={view} setView={setView} />
      </div>

      {SHOW_SUGGESTIONS && !hideSuggest && view === "chat" && filter === "all" && !loading && items.length > 0 && (
        <SuggestionPager items={SUGGESTION_DEMO} onDismissAll={() => setHideSuggest(true)} />
      )}

      {loading ? (
        <div style={{ padding: "40px 0", display: "flex", justifyContent: "center" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--brand-primary)", animation: "mPulse 1.6s ease-in-out infinite" }} />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          glyph="∅"
          head={items.length === 0 ? "Пока пусто" : "Ничего по этому фильтру"}
          copy={items.length === 0 ? "Сохрани первую мысль через +" : "Сбрось чипы, чтобы увидеть всё"}
        />
      ) : view === "chat" ? (
        <ChatView items={filtered} onMore={onMore} onOpen={onOpen} />
      ) : (
        <div style={{ padding: "4px 16px 0" }}>
          {filtered.map((b) => (
            <BookmarkCard key={b.id} bookmark={bookmarkToCard(b)} onOpen={() => onOpen(b)} onMore={() => onMore(b)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChatView({
  items,
  onMore,
  onOpen,
}: {
  items: Bookmark[];
  onMore: (b: Bookmark) => void;
  onOpen: (b: Bookmark) => void;
}) {
  // group by relative day for DaySeparator
  const rows: ({ sep: string } | { b: Bookmark })[] = [];
  let lastDay = "";
  for (const b of items) {
    const dayKey = formatDaySeparator(b.created_at);
    if (dayKey !== lastDay) {
      rows.push({ sep: dayKey });
      lastDay = dayKey;
    }
    rows.push({ b });
  }

  return (
    <div>
      {rows.map((r) => {
        if ("sep" in r) return <DaySeparator key={`sep-${r.sep}`} label={r.sep} />;
        const cr = bookmarkToChatRow(r.b);
        return (
          <div key={r.b.id} onClick={() => onOpen(r.b)}>
            <ChatRow
              avatar={cr.avatar}
              name={cr.name}
              time={cr.time}
              preview={cr.preview}
              src={cr.src}
              star={cr.star}
              pulsing={cr.pulsing}
              done={cr.done}
              muted={cr.muted}
              onMore={() => onMore(r.b)}
            />
          </div>
        );
      })}
    </div>
  );
}
