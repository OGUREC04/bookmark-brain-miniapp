/* Mini App shell — state-driven, DS-faithful (no router; one frame + sheets).
   Ported IA from docs/design-system-miniapp.

   Навигация = СТЕК слоёв над базовой вкладкой (`view`), + модальные `sheet` поверх.
   Единый источник приоритета: верх стека рендерится, back снимает sheet → потом слой.
   Раньше приоритет дублировался руками в 3 местах (render / BackButton / nav-visibility)
   — ловушка для нового dev. Теперь — один `top`/`popView`. */
import { useCallback, useEffect, useRef, useState } from "react";
import { BottomNav, type NavTab } from "./components/ds/Nav";
import { MysliScreen } from "./screens/Mysli";
import { SearchScreen } from "./screens/SearchScreen";
import { SpacesScreen } from "./screens/SpacesScreen";
import { MeScreen } from "./screens/MeScreen";
import { DetailScreen } from "./screens/DetailScreen";
import { SpaceDetailScreen } from "./screens/SpaceDetailScreen";
import { GraphScreen } from "./screens/GraphScreen";
import {
  ActionSheet,
  RemindersSheet,
  ReminderPickerSheet,
  MoveToSpaceSheet,
  QuickCreateSheet,
  type SheetTarget,
  type SpaceOption,
} from "./components/ds/Sheets";
import { api, type Bookmark, type Folder } from "./lib/api";
import { FLAGS } from "./lib/flags";
import { targetOf, groupReminders } from "./lib/adapters";
import { hapticImpact, hapticNotify, getBackButton } from "./lib/telegram";

type RemRow = {
  id: string;
  fire_at: string;
  bookmark_id?: string | null;
  bookmark_title: string | null;
  bookmark_raw_text: string | null;
  payload?: Record<string, unknown> | null;
};

/** Слой навигации над базовой вкладкой. Пустой стек = базовая вкладка (tab). */
type ViewLayer =
  | { kind: "search" }
  | { kind: "space"; space: Folder }
  | { kind: "detail"; bookmark: Bookmark }
  // FLAGS.CONNECTIONS: локальный эго-граф вокруг заметки (открыт из «Связано»).
  | { kind: "graph"; center: string };

type Sheet =
  | { type: "action"; target: SheetTarget; bookmark: Bookmark }
  | { type: "reminders" }
  | { type: "reminderPicker"; bookmark: Bookmark }
  | { type: "reminderReschedule"; reminderId: string; contextText: string; initialISO?: string | null }
  | { type: "moveToSpace"; bookmark: Bookmark }
  | { type: "quickCreate" }
  | null;

export function App() {
  const [tab, setTab] = useState<NavTab>("mysli");
  const [stack, setStack] = useState<ViewLayer[]>([]);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const top = stack.length > 0 ? stack[stack.length - 1] : null;
  // Закладка открытой заметки (верх стека = detail) — для эффектов/экшенов.
  const detailBookmark = top?.kind === "detail" ? top.bookmark : null;

  // "В разработке" stub for actions without backend yet.
  const comingSoon = useCallback(() => {
    hapticImpact("light");
    setToast("В разработке");
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const [reminders, setReminders] = useState<RemRow[]>([]);
  // Удалённое напоминание для undo-тоста (4 сек).
  const [remUndo, setRemUndo] = useState<RemRow | null>(null);
  const remUndoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  // ── Навигация (стек) ───────────────────────────────────────────────
  const pushView = useCallback((layer: ViewLayer) => setStack((s) => [...s, layer]), []);
  const popView = useCallback(() => setStack((s) => s.slice(0, -1)), []);
  const openDetail = useCallback(
    (b: Bookmark) => {
      hapticImpact("light");
      pushView({ kind: "detail", bookmark: b });
    },
    [pushView],
  );
  const openSpace = useCallback(
    (f: Folder) => {
      hapticImpact("light");
      pushView({ kind: "space", space: f });
    },
    [pushView],
  );
  // Заменить закладку открытой заметки (после мутации) — чтобы detail не был stale.
  // id-guard: если юзер уже ушёл на другую заметку, протухший async-ответ (refetch/poll
  // прошлой заметки) НЕ затирает текущую (race из code-review).
  const replaceDetail = useCallback((b: Bookmark) => {
    setStack((s) =>
      s.map((l, i) =>
        i === s.length - 1 && l.kind === "detail" && l.bookmark.id === b.id
          ? { kind: "detail", bookmark: b }
          : l,
      ),
    );
  }, []);
  // Перечитать открытую заметку с бэка (раздел #3: detail не должен показывать stale после
  // звезды/перемещения/правки списка из ⋮-меню поверх него).
  const refreshDetail = useCallback(
    async (id: string) => {
      try {
        const fresh = await api.getBookmark(id);
        replaceDetail(fresh);
      } catch {
        /* не критично — лента всё равно перезагрузится */
      }
    },
    [replaceDetail],
  );

  /**
   * Runs a mutating API action with uniform error handling: on success →
   * success haptic; on failure → error haptic (the sheet stays open so the
   * user can retry). Without this every handler swallowed rejections and
   * left the UI silently stuck (flagged by code review).
   */
  const runAction = useCallback(async (fn: () => Promise<void>) => {
    try {
      await fn();
      hapticNotify("success");
    } catch {
      hapticNotify("error");
    }
  }, []);

  // Удаление напоминания с возможностью undo (4 сек): оптимистично убираем из
  // списка, при «отменить» — пересоздаём с тем же bookmark/fire_at/payload.
  const cancelReminder = useCallback((rem: RemRow) => {
    runAction(async () => {
      await api.reminders.cancel(rem.id);
      setReminders((prev) => prev.filter((x) => x.id !== rem.id));
      reload();
      setRemUndo(rem);
      if (remUndoTimer.current) clearTimeout(remUndoTimer.current);
      remUndoTimer.current = setTimeout(() => {
        remUndoTimer.current = null;
        setRemUndo(null);
      }, 4000);
    });
  }, [runAction, reload]);

  const undoReminder = useCallback(() => {
    setRemUndo((rem) => {
      if (rem) {
        if (remUndoTimer.current) {
          clearTimeout(remUndoTimer.current);
          remUndoTimer.current = null;
        }
        runAction(async () => {
          await api.reminders.create(
            rem.bookmark_id ?? null,
            rem.fire_at,
            rem.payload ?? undefined
          );
          const r = await api.reminders.upcoming(50);
          setReminders(r.items);
          reload();
        });
      }
      return null;
    });
  }, [runAction, reload]);

  // Lazily load reminders / folders when a sheet needs them (race-guarded).
  useEffect(() => {
    let alive = true;
    if (sheet?.type === "reminders") {
      api.reminders
        .upcoming(50)
        .then((r) => alive && setReminders(r.items))
        .catch(() => alive && setReminders([]));
    }
    if (sheet?.type === "moveToSpace") {
      api.getFolders()
        .then((f) => alive && setFolders(f))
        .catch(() => alive && setFolders([]));
    }
    return () => {
      alive = false;
    };
  }, [sheet]);

  // Telegram BackButton: единый источник — back снимает sheet, иначе верхний слой стека.
  // Показ/скрытие завязаны ТОЛЬКО на булев `overlayOpen` (не на каждое изменение state),
  // а сам обработчик читается через ref — иначе кнопка мигала при открытии sheet поверх
  // detail (раздел #2 flicker: смена deps пересоздавала show/hide).
  const overlayOpen = sheet !== null || stack.length > 0;
  const backActionRef = useRef<() => void>(() => {});
  backActionRef.current = () => {
    if (sheet !== null) setSheet(null);
    else if (stack.length > 0) popView();
  };
  useEffect(() => {
    const back = getBackButton();
    if (!back) return;
    if (!overlayOpen) {
      back.hide();
      return;
    }
    back.show();
    const onClick = () => backActionRef.current();
    back.onClick(onClick);
    return () => back.offClick(onClick);
  }, [overlayOpen]);

  // FLAGS.TEXT_EDIT (тикет 0rn): пока открытая заметка обрабатывается AI (после правки текста
  // или свежее сохранение) — поллим, пока ai_status не станет терминальным, и обновляем detail.
  useEffect(() => {
    if (!FLAGS.TEXT_EDIT || !detailBookmark) return;
    const working = detailBookmark.ai_status === "pending" || detailBookmark.ai_status === "processing";
    if (!working) return;
    let cancelled = false;
    const id = detailBookmark.id;
    const timer = setInterval(async () => {
      try {
        const fresh = await api.getBookmark(id);
        if (cancelled) return;
        replaceDetail(fresh);
        if (fresh.ai_status !== "pending" && fresh.ai_status !== "processing") {
          clearInterval(timer);
          reload();
        }
      } catch {
        /* временная ошибка сети — продолжаем поллить */
      }
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailBookmark?.id, detailBookmark?.ai_status]);

  const openActions = useCallback((b: Bookmark) => {
    hapticImpact("medium");
    setSheet({ type: "action", target: targetOf(b), bookmark: b });
  }, []);

  // FLAGS.CONNECTIONS: тап по связанной заметке — догрузить полную и положить на стек.
  const openRelated = useCallback(
    (id: string) => {
      runAction(async () => {
        const b = await api.getBookmark(id);
        openDetail(b);
      });
    },
    [runAction, openDetail],
  );

  // FLAGS.CONNECTIONS: открыть локальный эго-граф вокруг заметки (из «Связано»).
  const openGraph = useCallback(
    (centerId: string) => {
      hapticImpact("light");
      pushView({ kind: "graph", center: centerId });
    },
    [pushView],
  );

  const onTab = stack.length === 0;

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        // clip (не hidden): не создаёт скролл-контейнер → не ломает sticky-шапку.
        overflowX: "clip",
        // Главная и списки — однотонный фон; фирменный градиент только на заметке.
        background: top?.kind === "detail" ? "var(--backdrop-gradient, var(--bg-page))" : "var(--bg-page)",
      }}
      className="app-shell"
    >
      <div
        key={
          top?.kind === "detail"
            ? `d-${top.bookmark.id}`
            : top?.kind === "space"
              ? `sp-${top.space.id}`
              : top?.kind === "graph"
                ? `g-${top.center}`
                : top?.kind === "search"
                  ? "search"
                  : tab
        }
        className="screen-fade"
      >
        {top?.kind === "detail" ? (
          <DetailScreen
            bookmark={top.bookmark}
            onBack={popView}
            onMore={() => openActions(top.bookmark)}
            onChanged={() => {
              reload();
              void refreshDetail(top.bookmark.id);
            }}
            onToast={setToast}
            // FLAGS.TEXT_EDIT (тикет 0rn): сохранить тело текста → refetch (ai_status может
            // переключиться в processing) → обновить detail и ленту.
            onSaveText={
              FLAGS.TEXT_EDIT
                ? async (rawText: string) => {
                    const updated = await api.updateBookmarkText(top.bookmark.id, rawText);
                    replaceDetail(updated);
                    reload();
                  }
                : undefined
            }
            onOpenRelated={FLAGS.CONNECTIONS ? openRelated : undefined}
            onOpenGraph={FLAGS.CONNECTIONS ? () => openGraph(top.bookmark.id) : undefined}
          />
        ) : top?.kind === "space" ? (
          <SpaceDetailScreen
            space={top.space}
            onBack={popView}
            onOpenNote={openDetail}
            onMore={openActions}
          />
        ) : top?.kind === "graph" ? (
          <GraphScreen mode="local" centerId={top.center} onBack={popView} onOpenNote={openRelated} />
        ) : top?.kind === "search" ? (
          <SearchScreen onBack={popView} onOpen={openDetail} />
        ) : tab === "mysli" ? (
          <MysliScreen
            reloadKey={reloadKey}
            onSearch={() => pushView({ kind: "search" })}
            onBell={() => setSheet({ type: "reminders" })}
            onMore={openActions}
            onOpen={openDetail}
          />
        ) : tab === "spaces" ? (
          <SpacesScreen onOpen={openSpace} onCreate={comingSoon} />
        ) : tab === "graph" ? (
          <GraphScreen mode="full" onOpenNote={openRelated} />
        ) : (
          <MeScreen onComingSoon={comingSoon} />
        )}
      </div>

      {onTab && (
        <BottomNav
          current={tab}
          showGraph={FLAGS.CONNECTIONS}
          onChange={(t) => {
            hapticImpact("light");
            setTab(t);
          }}
          onFab={() => {
            hapticImpact("light");
            setSheet({ type: "quickCreate" });
          }}
        />
      )}

      {sheet?.type === "action" && (
        <ActionSheet
          target={sheet.target}
          onDismiss={closeSheet}
          onRemind={() => setSheet({ type: "reminderPicker", bookmark: sheet.bookmark })}
          onStar={() =>
            runAction(async () => {
              await api.toggleFavorite(sheet.bookmark.id, !sheet.bookmark.is_favorite);
              closeSheet();
              reload();
              // #3: если звёздочку жали из ⋮ поверх открытой заметки — обновить её.
              if (detailBookmark?.id === sheet.bookmark.id) void refreshDetail(sheet.bookmark.id);
            })
          }
          onMove={() => setSheet({ type: "moveToSpace", bookmark: sheet.bookmark })}
          onDelete={() =>
            runAction(async () => {
              await api.deleteBookmark(sheet.bookmark.id);
              closeSheet();
              reload();
              // #3: удалили открытую заметку — снять её со стека (объекта больше нет).
              if (detailBookmark?.id === sheet.bookmark.id) popView();
            })
          }
        />
      )}

      {sheet?.type === "reminders" && (
        <RemindersSheet
          groups={groupReminders(reminders)}
          onDismiss={closeSheet}
          onCancel={(id) => {
            const rem = reminders.find((x) => x.id === id);
            if (rem) cancelReminder(rem);
          }}
          onSnooze={(id) => {
            const r = reminders.find((x) => x.id === id);
            const ctx =
              (typeof r?.payload?.text === "string" && r.payload.text.trim()) ||
              r?.bookmark_title ||
              "Напоминание";
            setSheet({ type: "reminderReschedule", reminderId: id, contextText: ctx, initialISO: r?.fire_at ?? null });
          }}
        />
      )}

      {sheet?.type === "reminderReschedule" && (
        <ReminderPickerSheet
          contextText={sheet.contextText}
          initialISO={sheet.initialISO}
          onDismiss={closeSheet}
          onBack={() => setSheet({ type: "reminders" })}
          onConfirm={(iso, text) =>
            runAction(async () => {
              // FLAGS.TEXT_EDIT (тикет 8uu): когда бэк примет text — переносим И правим текст.
              // Иначе snooze патчит только fire_at (правка текста не персистится, бэк-лимит).
              if (FLAGS.TEXT_EDIT) {
                await api.reminders.update(sheet.reminderId, { fireAt: iso, text });
              } else {
                await api.reminders.snooze(sheet.reminderId, iso);
              }
              setSheet({ type: "reminders" });
              reload();
            })
          }
        />
      )}

      {sheet?.type === "reminderPicker" && (
        <ReminderPickerSheet
          contextText={sheet.bookmark.title || (sheet.bookmark.raw_text ?? "").slice(0, 60) || "Без названия"}
          onDismiss={closeSheet}
          onBack={() => setSheet({ type: "action", target: targetOf(sheet.bookmark), bookmark: sheet.bookmark })}
          onConfirm={(iso, text) =>
            runAction(async () => {
              await api.reminders.create(sheet.bookmark.id, iso, { text });
              closeSheet();
            })
          }
        />
      )}

      {sheet?.type === "moveToSpace" && (
        <MoveToSpaceSheet
          spaces={folders.map<SpaceOption>((f) => ({ id: f.id, name: f.name, count: f.bookmarks_count, glyph: f.emoji || "·" }))}
          onDismiss={closeSheet}
          onBack={() => setSheet({ type: "action", target: targetOf(sheet.bookmark), bookmark: sheet.bookmark })}
          onPick={(folderId) =>
            runAction(async () => {
              await api.addBookmarkToFolder(folderId, sheet.bookmark.id);
              closeSheet();
              reload();
              if (detailBookmark?.id === sheet.bookmark.id) void refreshDetail(sheet.bookmark.id);
            })
          }
          onCreate={comingSoon}
        />
      )}

      {sheet?.type === "quickCreate" && (
        <QuickCreateSheet
          onDismiss={closeSheet}
          onSave={(text) =>
            runAction(async () => {
              await api.createThought(text);
              closeSheet();
              reload();
            })
          }
        />
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            top: "calc(16px + env(safe-area-inset-top, 0px))",
            transform: "translateX(-50%)",
            zIndex: 200,
            padding: "10px 18px",
            borderRadius: 999,
            background: "rgba(28,22,18,0.86)",
            color: "#FBF7EC",
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "-0.005em",
            boxShadow: "0 6px 20px rgba(60,40,25,0.28)",
            animation: "toastIn 200ms var(--ease-out, ease) both",
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          {toast}
        </div>
      )}

      {remUndo && (
        <div
          role="status"
          style={{
            position: "fixed",
            left: "50%",
            top: "calc(16px + env(safe-area-inset-top, 0px))",
            transform: "translateX(-50%)",
            zIndex: 300,
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "10px 14px 10px 18px",
            borderRadius: 999,
            background: "rgba(28,22,18,0.92)",
            color: "#FBF7EC",
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "-0.005em",
            boxShadow: "0 6px 20px rgba(60,40,25,0.28)",
            animation: "toastIn 200ms var(--ease-out, ease) both",
            whiteSpace: "nowrap",
          }}
        >
          <span>Напоминание удалено</span>
          <button
            type="button"
            onClick={undoReminder}
            style={{
              background: "transparent",
              border: "none",
              color: "#9DBE9D",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              padding: 0,
            }}
          >
            Отменить
          </button>
        </div>
      )}
    </div>
  );
}
