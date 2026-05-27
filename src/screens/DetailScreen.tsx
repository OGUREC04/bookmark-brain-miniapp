/* Заметка — detail view. Дизайн: ui_kits/mini_app Screens.jsx → NoteDetailScreen.
   Плоская editorial-раскладка (без карточки): мета-строка с инлайн-тегами,
   Lora-italic заголовок, summary, редактор списка, AI-блок «brain»,
   полноширинная кнопка источника. */
import { cloneElement } from "react";
import { Icons, ExtraIcons } from "../components/ds/icons";
import { TaskListEditor } from "../components/ds/TaskListEditor";
import { type Bookmark } from "../lib/api";
import { hostOf } from "../lib/adapters";
import { formatRelativeDate } from "../lib/formatters";

function openLink(url: string) {
  // Guard against javascript:/data: schemes sneaking in via stored bookmark.url.
  if (!/^https?:\/\//i.test(url)) return;
  const tg = window.Telegram?.WebApp as { openLink?: (u: string) => void } | undefined;
  if (tg?.openLink) tg.openLink(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

const navBtn = {
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
} as const;

export function DetailScreen({
  bookmark,
  onBack,
  onMore,
  onChanged,
  onToast,
}: {
  bookmark: Bookmark;
  onBack: () => void;
  onMore: () => void;
  /** Список отредактирован → родитель обновляет ленту. */
  onChanged?: () => void;
  /** Тост (например, ошибка сохранения списка). */
  onToast?: (msg: string) => void;
}) {
  const isUrl = (s: string) => /^https?:\/\//i.test(s.trim());
  const host = bookmark.url ? hostOf(bookmark.url) : null;
  const rawTitle = bookmark.title || (bookmark.raw_text ?? "").slice(0, 80) || "без названия";
  // Голая ссылка как заголовок выглядит уродливо (длинный URL) — показываем хост.
  const titleIsUrl = isUrl(rawTitle);
  const title = titleIsUrl ? host || "ссылка" : rawTitle;
  const isTaskList = bookmark.structured_data?.type === "task_list";
  // если заголовок = хост, не дублируем хост в мете
  const meta = [titleIsUrl ? null : host, formatRelativeDate(bookmark.created_at)].filter(Boolean).join(" · ");

  return (
    <div style={{ padding: "4px 0 calc(116px + env(safe-area-inset-bottom, 0px))" }}>
      {/* nav */}
      <div style={{ padding: "0 16px", display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <button onClick={onBack} aria-label="назад" style={navBtn}>
          {cloneElement(Icons.back, { size: 16, sw: 1.6 } as never)}
        </button>
        <div style={{ flex: 1 }} />
        <button onClick={onMore} aria-label="действия" style={navBtn}>
          {cloneElement(ExtraIcons.more, { size: 18, sw: 1.6 } as never)}
        </button>
      </div>

      <div style={{ padding: "0 22px" }}>
        {/* meta line: src · time + inline #tags + ai-processing */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", letterSpacing: ".04em" }}>{meta}</span>
          {(bookmark.tags ?? []).map((t) => (
            <span
              key={t.id}
              style={{ fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 500, color: "var(--brand-primary-press)", letterSpacing: "-0.005em" }}
            >
              #{t.name}
            </span>
          ))}
          <span
            onClick={() => onToast?.("теги · в разработке")}
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 13,
              fontWeight: 400,
              cursor: "pointer",
              color: "var(--fg-3)",
              borderBottom: "1px dashed var(--border-2)",
              lineHeight: 1.1,
              letterSpacing: "-0.005em",
            }}
          >
            +тег
          </span>
          {bookmark.ai_status !== "completed" && (
            <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 12, color: "var(--brand-primary-press)", letterSpacing: 0 }}>
              Brain думает…
            </span>
          )}
        </div>

        {/* title — editorial display italic */}
        <h1 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 500, fontSize: 28, letterSpacing: "-0.01em", color: "var(--fg-1)", lineHeight: 1.15, margin: "0 0 14px" }}>
          {title}
        </h1>

        {/* summary — UI sans */}
        {bookmark.summary && (
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--fg-2)", letterSpacing: "-0.005em", lineHeight: 1.5, marginBottom: 22 }}>
            {bookmark.summary}
          </div>
        )}

        {/* task list — flat */}
        {isTaskList && (
          <>
            <TaskListEditor bookmark={bookmark} onCommitted={onChanged} onError={onToast} onToast={onToast} />
            <div style={{ height: 16 }} />
          </>
        )}

        {/* raw text (non-tasklist notes) — но не голый URL (он уже в кнопке источника) */}
        {!isTaskList && bookmark.raw_text && bookmark.raw_text !== rawTitle && !isUrl(bookmark.raw_text) && (
          <p style={{ fontFamily: "var(--font-ui)", fontSize: 14.5, color: "var(--fg-1)", lineHeight: 1.55, margin: "0 0 22px", whiteSpace: "pre-wrap" }}>
            {bookmark.raw_text}
          </p>
        )}

        {/* AI «brain» block — key ideas joined by · */}
        {bookmark.key_ideas && bookmark.key_ideas.length > 0 && (
          <div
            style={{
              background: "rgba(218,234,218,0.45)",
              border: "0.5px solid rgba(122,156,122,0.22)",
              borderRadius: 14,
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginBottom: 22,
            }}
          >
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--brand-primary-press)", letterSpacing: ".04em", fontWeight: 500 }}>
              brain
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 14, color: "var(--fg-1)", lineHeight: 1.5, letterSpacing: 0 }}>
              {bookmark.key_ideas.join(" · ")}
            </div>
          </div>
        )}

        {/* open source + copy link */}
        {bookmark.url && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => openLink(bookmark.url!)}
              style={{
                flex: 1,
                background: "transparent",
                border: "1px solid var(--border-1)",
                borderRadius: 12,
                padding: "11px 16px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                color: "var(--fg-1)",
                fontFamily: "var(--font-ui)",
                fontSize: 14,
                fontWeight: 500,
                letterSpacing: "-0.005em",
              }}
            >
              {cloneElement(Icons.link, { size: 14, sw: 1.7 } as never)}
              Открыть источник
            </button>
            <button
              aria-label="скопировать ссылку"
              onClick={() => {
                try {
                  void navigator.clipboard?.writeText(bookmark.url!);
                  onToast?.("ссылка скопирована");
                } catch {
                  /* clipboard недоступен */
                }
              }}
              style={{
                flexShrink: 0,
                width: 44,
                background: "transparent",
                border: "1px solid var(--border-1)",
                borderRadius: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--fg-2)",
              }}
            >
              {cloneElement(ExtraIcons.copy, { size: 16, sw: 1.7 } as never)}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
