/* Заметка — detail view. Дизайн: ui_kits/mini_app Screens.jsx → NoteDetailScreen.
   Плоская editorial-раскладка (без карточки): мета-строка с инлайн-тегами,
   Lora-italic заголовок, summary, редактор списка, AI-блок «brain»,
   полноширинная кнопка источника. */
import { cloneElement, useState, useRef, useCallback, useEffect } from "react";
import { Icons, ExtraIcons } from "../components/ds/icons";
import { TaskListEditor } from "../components/ds/TaskListEditor";
import { RelatedSection, type RelatedRow } from "../components/ds/RelatedSection";
import { ThreadComposer } from "../components/ds/ThreadComposer";
import { ThreadLog } from "../components/ds/ThreadLog";
import { applyTranscriptionUpdates, mergeEntriesById } from "../lib/thread";
import { BottomSheet } from "../components/ds/sheetPrimitives";
import { api, AuthExpiredError, type Bookmark, type Entry } from "../lib/api";
import { hostOf, isWorkingStatus } from "../lib/adapters";
import { FLAGS } from "../lib/flags";
import { formatRelativeDate } from "../lib/formatters";

const isUrl = (s: string) => /^https?:\/\//i.test(s.trim());

// Интервал thread-поллинга статуса голос-дописки (мс). Как note-level поллинг (App.tsx).
const THREAD_POLL_MS = 3000;
// Сколько подряд сетевых сбоев терпит поллинг, прежде чем остановиться (не молотить вечно).
const MAX_THREAD_POLL_FAILS = 5;

/** Русское склонение по числу: 1 связь, 2–4 связи, 5+ связей. */
function pluralRu(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

function openLink(url: string) {
  // Guard against javascript:/data: schemes sneaking in via stored bookmark.url.
  // trim() — как в isUrl(): иначе валидный URL с ведущим пробелом молча не откроется.
  if (!/^https?:\/\//i.test(url.trim())) return;
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
  onSaveText,
  onOpenRelated,
  onOpenGraph,
}: {
  bookmark: Bookmark;
  onBack: () => void;
  onMore: () => void;
  /** Список отредактирован → родитель обновляет ленту. */
  onChanged?: () => void;
  /** Тост (например, ошибка сохранения списка). */
  onToast?: (msg: string) => void;
  /** FLAGS.TEXT_EDIT (тикет 0rn): сохранить тело текста. undefined = редактирование выключено. */
  onSaveText?: (rawText: string) => Promise<void>;
  /** FLAGS.CONNECTIONS: открыть связанную заметку по id. undefined = секция «Связано» выключена. */
  onOpenRelated?: (id: string) => void;
  /** FLAGS.CONNECTIONS: открыть локальный граф вокруг этой заметки. */
  onOpenGraph?: () => void;
}) {
  const host = bookmark.url ? hostOf(bookmark.url) : null;
  const rawTitle = bookmark.title || (bookmark.raw_text ?? "").slice(0, 80) || "Без названия";
  // Голая ссылка как заголовок выглядит уродливо (длинный URL) — показываем хост.
  const titleIsUrl = isUrl(rawTitle);
  const title = titleIsUrl ? host || "Ссылка" : rawTitle;
  const isTaskList = bookmark.structured_data?.type === "task_list";
  // если заголовок = хост, не дублируем хост в мете
  const meta = [titleIsUrl ? null : host, formatRelativeDate(bookmark.created_at)].filter(Boolean).join(" · ");

  // FLAGS.CONNECTIONS — секция «Связано» (похожие заметки). Грузим при открытии заметки.
  const [related, setRelated] = useState<RelatedRow[]>([]);
  const [relatedTotal, setRelatedTotal] = useState(0);
  const [showAllRelated, setShowAllRelated] = useState(false);
  const [relatedOpen, setRelatedOpen] = useState(false); // шторка «Связано» (вход — чип под метой)
  // Смена заметки — сбрасываем «показать все» и закрываем шторку связей.
  useEffect(() => {
    setShowAllRelated(false);
    setRelatedOpen(false);
    setRelated([]); // не показываем связи прошлой заметки, пока грузятся новые
    setRelatedTotal(0);
  }, [bookmark.id]);
  useEffect(() => {
    if (!onOpenRelated) return;
    let cancelled = false;
    // all=true → лимит не нужен (бэк отдаёт все связи); превью — топ-5.
    api.getRelated(bookmark.id, 5, showAllRelated)
      .then((res) => {
        if (cancelled) return;
        setRelatedTotal(res.total);
        setRelated(
          res.items.map((it) => ({
            id: it.id,
            title: it.title || (it.summary ?? "").slice(0, 60) || "Без названия",
            summary: it.summary,
          })),
        );
      })
      .catch(() => {
        // НЕ обнуляем: сбой re-fetch не должен стирать уже показанные связи и счётчик
        // (стейл прошлой заметки чистится сбросом по bookmark.id выше).
      });
    return () => {
      cancelled = true;
    };
  }, [bookmark.id, showAllRelated, onOpenRelated]);

  // F3a/F3b/F3d — лента дописок (заметка-как-диалог). Грузим при открытии; дописка
  // (текст/голос) приходит из ThreadComposer через onPosted.
  const [entries, setEntries] = useState<Entry[]>([]);
  useEffect(() => {
    if (!FLAGS.NOTES_LOG) return;
    let cancelled = false;
    setEntries([]); // не показываем дописки прошлой заметки, пока грузятся новые
    api.entries
      .list(bookmark.id)
      .then((t) => {
        // merge, не replace: медленная загрузка не должна затереть дописку, добавленную
        // локально пока запрос был в полёте (находка ревью F3d — потеря данных).
        if (!cancelled) setEntries((prev) => mergeEntriesById(t.entries, prev));
      })
      .catch(() => {
        // Шапка заметки приходит из prop bookmark и остаётся рабочей — лента некритична,
        // но не молчим: иначе «ошибка загрузки» неотличима от «дописок ещё нет» (ревью).
        if (!cancelled) onToast?.("Не удалось загрузить дописки");
      });
    return () => {
      cancelled = true;
    };
  }, [bookmark.id]);

  // F3d — новая дописка (текст или голос-черновик 'transcribing'): добавить в конец +
  // прокрутить вниз к ней. Голос дальше распознаётся воркером — подхватит thread-поллинг.
  const onPosted = useCallback((entry: Entry) => {
    setEntries((prev) => [...prev, entry]);
    requestAnimationFrame(() =>
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }),
    );
  }, []);

  // F3c — правка/удаление дописки. Бросают при ошибке: EntryBubble держит режим правки
  // и показывает тост. Успех → локально заменяем/убираем запись (оптимистично).
  const editEntry = useCallback(
    async (id: string, body: string) => {
      const updated = await api.entries.edit(bookmark.id, id, body);
      setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)));
    },
    [bookmark.id],
  );
  const deleteEntry = useCallback(
    async (id: string) => {
      await api.entries.remove(bookmark.id, id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    },
    [bookmark.id],
  );

  // F3d — thread-поллинг (DEC-11): пока в ленте есть запись 'transcribing', перечитываем
  // GET /thread, пока статус не станет терминальным. ОТДЕЛЬНО от note-level поллинга шапки
  // (App.tsx по ai_status всей заметки): тот голос-дописку не видит (другая сущность).
  const hasTranscribing = entries.some((e) => e.entry_ai_status === "transcribing");
  useEffect(() => {
    if (!FLAGS.NOTES_LOG || !hasTranscribing) return;
    let cancelled = false;
    let fetching = false; // не накладываем тики: медленный ответ не плодит параллельные запросы
    let fails = 0;
    const timer = setInterval(async () => {
      if (fetching) return;
      fetching = true;
      try {
        const t = await api.entries.list(bookmark.id);
        // Обновляем ТОЛЬКО распознаваемые записи: поллинг не должен трогать остальные —
        // иначе стейл-снапшот откатил бы локальную правку/воскресил удалённую (ревью F3c).
        if (!cancelled) setEntries((prev) => applyTranscriptionUpdates(prev, t.entries));
        fails = 0;
      } catch (e) {
        // Токен умер (401) или бэк стабильно недоступен — не молотим вечно раз в 3с (ревью).
        if (e instanceof AuthExpiredError || ++fails >= MAX_THREAD_POLL_FAILS) clearInterval(timer);
      } finally {
        fetching = false;
      }
    }, THREAD_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [bookmark.id, hasTranscribing]);

  // FLAGS.TEXT_EDIT — inline-правка тела текста (тикет 0rn). Доступна когда родитель дал onSaveText.
  // Тело = raw_text (каноничное поле; для голосовых бэк уточнит — см. бриф BOOKMARK-TEXT-EDIT).
  const canEditText = !!onSaveText && !isTaskList;
  // Для голой ссылки тело пустое → даём «дописать заметку» (raw_text=url не показываем как текст).
  const bodyText = isUrl(bookmark.raw_text ?? "") ? "" : (bookmark.raw_text ?? "");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(bodyText);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const autoGrow = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  const startEdit = () => {
    setDraft(bodyText);
    setEditing(true);
    requestAnimationFrame(() => {
      taRef.current?.focus();
      autoGrow();
    });
  };
  // Текст, уже отправленный на сохранение (в полёте/сохранён) — чтобы автосейв на blur
  // и flush при размонтировании не слали один и тот же PATCH дважды (двойная AI-обработка).
  const savingRef = useRef<string | null>(null);
  // Автосейв: вызывается на blur текстарии. No-op если пусто/без изменений/уже сохраняем —
  // тихо, без тостов (как Apple Notes). Ошибка — единственный тост.
  const saveEdit = async () => {
    const next = draft.trim();
    if (!next || next === bodyText.trim() || !onSaveText || savingRef.current === next) {
      setEditing(false);
      return;
    }
    savingRef.current = next;
    try {
      await onSaveText(next);
      setEditing(false);
    } catch {
      savingRef.current = null;
      onToast?.("Не удалось сохранить");
    }
  };

  // Жёсткий «Назад» (Telegram/системная кнопка) и переход на связанную заметку НЕ вызывают
  // blur текстарии → автосейв на blur не срабатывает. Сохраняем черновик при размонтировании
  // экрана. Через refs — cleanup читает последние значения, а не значения первого рендера.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const bodyTextRef = useRef(bodyText);
  bodyTextRef.current = bodyText;
  const onSaveTextRef = useRef(onSaveText);
  onSaveTextRef.current = onSaveText;
  // onToast — это setToast РОДИТЕЛЯ (App), который при popView НЕ размонтируется → тост из
  // cleanup достижим (в отличие от локального setState). Через ref — последнее значение.
  const onToastRef = useRef(onToast);
  onToastRef.current = onToast;
  useEffect(() => {
    return () => {
      if (!editingRef.current) return;
      const next = draftRef.current.trim();
      const save = onSaveTextRef.current;
      if (!next || next === bodyTextRef.current.trim() || !save || savingRef.current === next) return;
      savingRef.current = next;
      // fire-and-forget: компонент уже уходит, локальный state не трогаем. Но об ошибке
      // сигналим через родительский тост — иначе правка теряется на hard-back молча (ревью).
      void save(next).catch(() => onToastRef.current?.("Не удалось сохранить — текст не сохранён"));
    };
  }, []);

  return (
    <div style={{ padding: FLAGS.NOTES_LOG ? "4px 0 calc(96px + env(safe-area-inset-bottom, 0px))" : "4px 0 calc(74px + env(safe-area-inset-bottom, 0px))" }}>
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
        {/* верх-утилита: дата слева · связи справа (вход в шторку), тонкий разделитель */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, paddingBottom: 10, marginBottom: 14, borderBottom: "0.5px solid var(--border-1)" }}>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-3)", letterSpacing: "-0.005em" }}>{meta}</span>
          {onOpenRelated && relatedTotal > 0 ? (
            <button
              type="button"
              onClick={() => setRelatedOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: "transparent",
                border: "none",
                padding: 0,
                color: "var(--brand-primary-press)",
                fontFamily: "var(--font-ui)",
                fontSize: 12.5,
                fontWeight: 500,
                letterSpacing: "-0.005em",
                cursor: "pointer",
                flexShrink: 0,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {cloneElement(Icons.link, { size: 13, sw: 1.8 } as never)}
              {relatedTotal} {pluralRu(relatedTotal, "связь", "связи", "связей")}
            </button>
          ) : bookmark.ai_status === "failed" ? (
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 12, color: "var(--fg-3)", letterSpacing: "-0.005em", flexShrink: 0 }}>
              {bookmark.content_type === "voice" ? "Не распознал" : "Ошибка обработки"}
            </span>
          ) : isWorkingStatus(bookmark.ai_status) ? (
            <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 12, color: "var(--brand-primary-press)", flexShrink: 0 }}>
              {bookmark.content_type === "voice" ? "Brain слушает…" : "Brain думает…"}
            </span>
          ) : null}
        </div>

        {/* title — editorial display italic */}
        <h1 style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 500, fontSize: 28, letterSpacing: "-0.01em", color: "var(--fg-1)", lineHeight: 1.15, margin: "0 0 12px" }}>
          {title}
        </h1>

        {/* теги — тихим текстом (без решёток/плашек), «добавить» пунктиром */}
        <div style={{ fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--fg-3)", letterSpacing: "-0.005em", marginBottom: 18 }}>
          {(bookmark.tags ?? []).map((t) => (
            <span key={t.id}>{t.name} · </span>
          ))}
          <span
            onClick={() => onToast?.("Теги · в разработке")}
            style={{ cursor: "pointer", borderBottom: "1px dashed var(--border-2)" }}
          >
            добавить
          </span>
        </div>

        {/* AI «Brain» — тезисы (key_ideas) буллетами, наверху после заголовка (формат B) */}
        {bookmark.key_ideas && bookmark.key_ideas.length > 0 && (
          <div
            style={{
              background: "rgba(218,234,218,0.45)",
              border: "0.5px solid rgba(122,156,122,0.22)",
              borderRadius: 14,
              padding: "12px 14px",
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 9, fontFamily: "var(--font-ui)", fontSize: 11.5, fontWeight: 600, color: "var(--brand-primary-press)", letterSpacing: "-0.005em" }}>
              {cloneElement(ExtraIcons.sparkle, { size: 13, sw: 1.7 } as never)}
              Brain
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {bookmark.key_ideas.map((idea, i) => (
                <div key={i} style={{ display: "flex", gap: 8, fontFamily: "var(--font-ui)", fontSize: 13.5, color: "var(--fg-1)", lineHeight: 1.4, letterSpacing: "-0.005em" }}>
                  <span style={{ color: "var(--brand-primary)", flexShrink: 0, marginTop: 1 }}>•</span>
                  <span>{idea.charAt(0).toUpperCase() + idea.slice(1)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* summary — UI sans */}
        {bookmark.summary && (
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 14, color: "var(--fg-2)", letterSpacing: "-0.005em", lineHeight: 1.5, marginBottom: 22 }}>
            {bookmark.summary}
          </div>
        )}

        {/* плейсхолдер контекста для голой ссылки (контекст приходит из AI-пайплайна) */}
        {titleIsUrl && !bookmark.summary && (
          <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.45, marginBottom: 22 }}>
            {bookmark.ai_status !== "completed" ? "Brain читает ссылку…" : "Контекст не извлёкся — открой источник"}
          </div>
        )}

        {/* task list — flat */}
        {isTaskList && (
          <>
            <TaskListEditor bookmark={bookmark} onCommitted={onChanged} onError={onToast} onToast={onToast} />
            <div style={{ height: 16 }} />
          </>
        )}

        {/* raw text (non-tasklist notes) — но не голый URL (он уже в кнопке источника).
            FLAGS.TEXT_EDIT: canEditText → inline-редактор; иначе read-only абзац как раньше. */}
        {!canEditText &&
          !isTaskList &&
          bookmark.raw_text &&
          bookmark.raw_text !== rawTitle &&
          !isUrl(bookmark.raw_text) && (
            <p style={{ fontFamily: "var(--font-ui)", fontSize: 14.5, color: "var(--fg-1)", lineHeight: 1.55, margin: "0 0 22px", whiteSpace: "pre-wrap", overflowWrap: "break-word", wordBreak: "break-word" }}>
              {bookmark.raw_text}
            </p>
          )}

        {canEditText && (
          <div style={{ margin: "0 0 24px" }}>
            {editing ? (
              // Текстарея «как проза»: прозрачная, без рамки, тем же шрифтом, что и
              // read-view → нет визуального «режима». Курсор = единственный признак
              // правки (Apple Notes). Сохранение — на blur (автосейв), без Save/Cancel.
              <textarea
                ref={taRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  autoGrow();
                }}
                onBlur={saveEdit}
                aria-label="текст заметки"
                placeholder="Добавь текст…"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  outline: "none",
                  resize: "none",
                  overflow: "hidden",
                  overflowWrap: "break-word",
                  wordBreak: "break-word",
                  fontFamily: "var(--font-ui)",
                  fontSize: 14.5,
                  lineHeight: 1.6,
                  color: "var(--fg-1)",
                  caretColor: "var(--brand-primary)",
                  letterSpacing: "-0.005em",
                }}
              />
            ) : (
              // Тап по тексту = правка (без кнопки «Изменить»).
              <div
                onClick={startEdit}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    startEdit();
                  }
                }}
                style={{ cursor: "text" }}
              >
                {bodyText ? (
                  <p style={{ fontFamily: "var(--font-ui)", fontSize: 14.5, color: "var(--fg-1)", lineHeight: 1.6, margin: 0, whiteSpace: "pre-wrap", overflowWrap: "break-word", wordBreak: "break-word" }}>
                    {bodyText}
                  </p>
                ) : (
                  <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 14, color: "var(--fg-3)" }}>
                    + добавить текст
                  </span>
                )}
              </div>
            )}
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
                if (!navigator.clipboard) {
                  onToast?.("Копирование недоступно");
                  return;
                }
                navigator.clipboard
                  .writeText(bookmark.url!)
                  .then(() => onToast?.("Ссылка скопирована"))
                  .catch(() => onToast?.("Не удалось скопировать"));
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

        {/* Лента дописок (заметка-как-диалог): F3a чтение + F3d статусы голос-дописки.
            Тихий маркер edge#12: саммари построено до дописок и их не учитывает. */}
        {FLAGS.NOTES_LOG && entries.length > 0 && (
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: "0.5px solid var(--border-1)" }}>
            {bookmark.summary && (
              <div style={{ textAlign: "center", fontFamily: "var(--font-ui)", fontSize: 11.5, color: "var(--fg-4)", marginBottom: 4, letterSpacing: "-0.005em" }}>
                Саммари выше не учитывает дописки
              </div>
            )}
            <ThreadLog entries={entries} onEdit={editEntry} onDelete={deleteEntry} onToast={onToast} />
          </div>
        )}
      </div>

      {/* Шторка «Связано» — открывается чипом под метой. Список связей + вход в граф. */}
      {relatedOpen && onOpenRelated && (
        <BottomSheet onDismiss={() => setRelatedOpen(false)}>
          <div style={{ padding: "2px 18px 10px" }}>
            <RelatedSection
              rows={related}
              total={relatedTotal}
              showingAll={showAllRelated}
              onOpen={(id) => {
                setRelatedOpen(false);
                onOpenRelated(id);
              }}
              onShowAll={() => setShowAllRelated(true)}
              onOpenGraph={onOpenGraph ? () => { setRelatedOpen(false); onOpenGraph(); } : undefined}
            />
          </div>
        </BottomSheet>
      )}

      {/* F3b/F3d — закреплённый снизу композер дописок (текст + голос).
          Контент сверху имеет нижний отступ под него (root paddingBottom). */}
      {FLAGS.NOTES_LOG && (
        <ThreadComposer bookmarkId={bookmark.id} onPosted={onPosted} onToast={onToast} />
      )}
    </div>
  );
}
