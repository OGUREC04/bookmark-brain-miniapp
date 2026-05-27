/* Экран пространства (папки): hero-глиф + название + список закладок папки.
   Дизайн: ui_kits/mini_app Screens.jsx → SpaceDetailScreen. Данные — реальные
   через api.getFolderBookmarks. Закрывает bd bookmark-brain-8g1 (open). */
import { useEffect, useState, cloneElement } from "react";
import { Icons } from "../components/ds/icons";
import { ChatRow, DaySeparator } from "../components/ds/ChatRow";
import { Pulse, EmptyState } from "../components/ds/atoms";
import { api, type Folder, type Bookmark } from "../lib/api";
import { bookmarkToChatRow } from "../lib/adapters";
import { formatDaySeparator } from "../lib/formatters";

const TONE_GRADS: Record<string, string> = {
  sage: "linear-gradient(135deg, #BBD0BA 0%, #7A9C7A 100%)",
  honey: "linear-gradient(135deg, #E6D2B0 0%, #B8946A 100%)",
  slate: "linear-gradient(135deg, #B6C7D2 0%, #6E8898 100%)",
  plum: "linear-gradient(135deg, #C9BCD3 0%, #8E7AA0 100%)",
  clay: "linear-gradient(135deg, #E6B5A8 0%, #B86A55 100%)",
  moss: "linear-gradient(135deg, #C5D49D 0%, #8AA15A 100%)",
};
const TONES = ["sage", "honey", "slate", "plum", "clay", "moss"];
const GLYPHS = ["¶", "§", "℘", "∞", "★", "∆", "◇", "∴"];

function pick<T>(arr: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h + seed.charCodeAt(i)) % arr.length;
  return arr[h];
}

export function SpaceDetailScreen({
  space,
  onBack,
  onOpenNote,
  onMore,
}: {
  space: Folder;
  onBack: () => void;
  onOpenNote: (b: Bookmark) => void;
  onMore: (b: Bookmark) => void;
}) {
  const [items, setItems] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    api
      .getFolderBookmarks(space.id, 1, 50)
      .then((r) => {
        if (alive) setItems(r.items);
      })
      .catch(() => {
        if (alive) {
          setItems([]);
          setError(true);
        }
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [space.id]);

  const tone = pick(TONES, space.id);
  const glyph = space.emoji || pick(GLYPHS, space.name);

  // группировка по дням (как в ленте)
  const rows: ({ sep: string } | { b: Bookmark })[] = [];
  let lastDay = "";
  for (const b of items) {
    const day = formatDaySeparator(b.created_at);
    if (day !== lastDay) {
      rows.push({ sep: day });
      lastDay = day;
    }
    rows.push({ b });
  }

  return (
    <div style={{ padding: "6px 0 calc(116px + env(safe-area-inset-bottom, 0px))" }}>
      {/* nav */}
      <div style={{ padding: "0 16px", display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button
          onClick={onBack}
          aria-label="назад"
          style={{
            background: "var(--surface-glass-strong)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid var(--border-1)",
            width: 36,
            height: 36,
            borderRadius: "50%",
            color: "var(--fg-1)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "var(--shadow-glass-chip)",
          }}
        >
          {cloneElement(Icons.back, { size: 16, sw: 1.6 } as never)}
        </button>
      </div>

      {/* hero: big glyph tile + title + count */}
      <div style={{ padding: "0 16px 18px", display: "flex", gap: 14, alignItems: "flex-end" }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 18,
            background: TONE_GRADS[tone] || TONE_GRADS.sage,
            color: tone === "honey" ? "#2B1F12" : "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), 0 8px 18px rgba(60,40,25,0.10)",
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: 36,
            fontWeight: 500,
            letterSpacing: "-0.01em",
            flexShrink: 0,
          }}
        >
          {glyph}
        </div>
        <div style={{ flex: 1, paddingBottom: 4, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 500, letterSpacing: "-0.025em", color: "var(--fg-1)", lineHeight: 1.1 }}>
            {space.name}
          </h1>
          <div style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", letterSpacing: ".04em" }}>
            {space.bookmarks_count} закладок
          </div>
        </div>
      </div>

      {/* contents */}
      {loading ? (
        <div style={{ padding: "40px 0", display: "flex", justifyContent: "center" }}>
          <Pulse />
        </div>
      ) : error ? (
        <EmptyState glyph="⚠" head="не загрузилось" copy="проверь связь и зайди снова" />
      ) : items.length === 0 ? (
        <EmptyState glyph="∅" head="пусто" copy="перемести сюда закладки через ⋯ → переместить" />
      ) : (
        <div>
          {rows.map((r) => {
            if ("sep" in r) return <DaySeparator key={`sep-${r.sep}`} label={r.sep} />;
            const cr = bookmarkToChatRow(r.b);
            return (
              <div key={r.b.id} onClick={() => onOpenNote(r.b)}>
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
      )}
    </div>
  );
}
