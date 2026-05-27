/* Интерактивный редактор task-list для DetailScreen.
   PRD: docs/prd/TASK-LIST-EDITING.md (в монорепо bookmark-brain).
   US-1 тоггл · US-2 edit · US-3 delete+undo · US-4 add. Дальше: US-5 (deadline).
   Все мутации — optimistic + debounce 400мс, revert при ошибке. Бэкенд на PATCH
   structured_data сам запускает reminder-cascade (создаёт/переносит/отменяет
   напоминания по task.deadline) — фронт просто шлёт обновлённый массив.
   Строка/добавление — в TaskRow.tsx / AddRow.tsx. */
import { useCallback, useEffect, useRef, useState, cloneElement, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { api, type Bookmark, type TaskItem } from "../../lib/api";
import { hapticSelection, hapticNotify } from "../../lib/telegram";
import { MAX_TASK_LEN } from "./taskEditorShared";
import { TaskRow } from "./TaskRow";
import { AddRow } from "./AddRow";
import { BottomSheet, SheetTitle } from "./Sheets";
import { DatePickerSheet } from "./DatePickerSheet";
import { ExtraIcons } from "./icons";

const COMMIT_DEBOUNCE_MS = 400;

function newId(): string {
  return crypto.randomUUID?.() ?? `t${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
}

function extractTasks(b: Bookmark): TaskItem[] {
  const tasks = b.structured_data?.type === "task_list" ? b.structured_data.tasks : [];
  // Бэкфилл стабильного id (бэк хранит без id) — нужен для React-ключей при
  // delete+undo/edit, иначе индекс-ключи путают локальное editing-состояние строк.
  return tasks.map((t) => (t.id ? t : { ...t, id: newId() }));
}

export function TaskListEditor({
  bookmark,
  onCommitted,
  onError,
  onToast,
}: {
  bookmark: Bookmark;
  /** Вызывается после успешного PATCH — родитель обновляет ленту. */
  onCommitted?: (updated: Bookmark) => void;
  /** Текст для тоста при провале сохранения. */
  onError?: (msg: string) => void;
  /** Информационный тост (например «скопировано»). */
  onToast?: (msg: string) => void;
}) {
  const [tasks, setTasks] = useState<TaskItem[]>(() => extractTasks(bookmark));

  // last-known-good для отката при провале PATCH
  const savedRef = useRef<TaskItem[]>(tasks);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<TaskItem[] | null>(null);
  const aliveRef = useRef(true);

  // Зеркало tasks для синхронного чтения вне state-апдейтера (StrictMode
  // вызывает апдейтер дважды — сайд-эффекты делаем снаружи, не в нём).
  const tasksRef = useRef<TaskItem[]>(tasks);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  // US-3: удалённый пункт для undo-snackbar (4 сек).
  const [deleted, setDeleted] = useState<{ task: TaskItem; index: number } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Открытые оверлеи: kebab-меню и календарь дедлайна (по индексу пункта).
  const [menuIndex, setMenuIndex] = useState<number | null>(null);
  const [deadlineIndex, setDeadlineIndex] = useState<number | null>(null);

  const commit = useCallback(
    async (next: TaskItem[], silent = false) => {
      pendingRef.current = null;
      try {
        const updated = await api.updateBookmark(bookmark.id, {
          structured_data: { type: "task_list", tasks: next },
        });
        savedRef.current = next;
        onCommitted?.(updated);
      } catch {
        // откат к последнему сохранённому состоянию
        if (!silent && aliveRef.current) setTasks(savedRef.current);
        hapticNotify("error");
        onError?.("не сохранилось");
      }
    },
    [bookmark.id, onCommitted, onError]
  );

  const scheduleCommit = useCallback(
    (next: TaskItem[]) => {
      pendingRef.current = next;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (pendingRef.current) void commit(pendingRef.current);
      }, COMMIT_DEBOUNCE_MS);
    },
    [commit]
  );

  // Флаш pending-дебаунса при unmount — не теряем последнее изменение (edge case 12).
  useEffect(() => {
    return () => {
      aliveRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        if (pendingRef.current) void commit(pendingRef.current, true);
      }
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
      }
    };
  }, [commit]);

  const toggle = useCallback(
    (index: number) => {
      hapticSelection();
      setTasks((prev) => {
        const next = prev.map((t, i) => (i === index ? { ...t, done: !t.done } : t));
        scheduleCommit(next);
        return next;
      });
    },
    [scheduleCommit]
  );

  // US-2: применить отредактированный текст. Пустой (после trim) → удалить пункт
  // (US-3: с undo-snackbar). Side-effects вне апдейтера — читаем tasksRef.
  const editText = useCallback(
    (index: number, raw: string) => {
      const text = raw.trim().slice(0, MAX_TASK_LEN);
      const current = tasksRef.current[index];
      if (!current || text === current.text) return; // нет изменений

      if (text === "") {
        const next = tasksRef.current.filter((_, i) => i !== index);
        tasksRef.current = next;
        setTasks(next);
        scheduleCommit(next);
        hapticNotify("warning");
        setDeleted({ task: current, index });
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        undoTimerRef.current = setTimeout(() => {
          undoTimerRef.current = null;
          setDeleted(null);
        }, 4000);
      } else {
        const next = tasksRef.current.map((t, i) => (i === index ? { ...t, text } : t));
        tasksRef.current = next;
        setTasks(next);
        scheduleCommit(next);
        hapticSelection();
      }
    },
    [scheduleCommit]
  );

  const undoDelete = useCallback(() => {
    if (!deleted) return;
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    const arr = tasksRef.current.slice();
    arr.splice(Math.min(deleted.index, arr.length), 0, deleted.task);
    tasksRef.current = arr;
    setTasks(arr);
    scheduleCommit(arr);
    setDeleted(null);
    hapticSelection();
  }, [deleted, scheduleCommit]);

  const copyText = useCallback(
    (text: string) => {
      try {
        void navigator.clipboard?.writeText(text);
        hapticNotify("success");
        onToast?.("скопировано");
      } catch {
        /* clipboard недоступен — молча игнорируем */
      }
    },
    [onToast]
  );

  // US-5: установить/сменить/снять дедлайн пункта (YYYY-MM-DD | null).
  // PATCH запускает reminder-cascade на бэке (создаст/перенесёт/отменит напоминание).
  const setDeadline = useCallback(
    (index: number, value: string | null) => {
      const current = tasksRef.current[index];
      if (!current || (current.deadline ?? null) === value) return; // нет изменений
      const next = tasksRef.current.map((t, i) => (i === index ? { ...t, deadline: value } : t));
      tasksRef.current = next;
      setTasks(next);
      scheduleCommit(next);
      hapticSelection();
    },
    [scheduleCommit]
  );

  // US-4: добавить новый пункт в конец списка.
  const addTask = useCallback(
    (raw: string) => {
      const text = raw.trim().slice(0, MAX_TASK_LEN);
      if (!text) return;
      const next = [...tasksRef.current, { id: newId(), text, done: false, deadline: null }];
      tasksRef.current = next;
      setTasks(next);
      scheduleCommit(next);
      hapticNotify("success");
    },
    [scheduleCommit]
  );

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, margin: "0 0 14px" }}>
        {tasks.map((t, i) => (
          <TaskRow
            key={t.id ?? i}
            task={t}
            index={i}
            onToggle={() => toggle(i)}
            onEdit={(text) => editText(i, text)}
            onMenu={() => setMenuIndex(i)}
            onOpenDeadline={() => setDeadlineIndex(i)}
          />
        ))}
        <AddRow onAdd={addTask} />
      </div>

      {deleted &&
        createPortal(
          <div
            role="status"
            style={{
              position: "fixed",
              left: "50%",
              bottom: "calc(24px + env(safe-area-inset-bottom, 0px))",
              transform: "translateX(-50%)",
              zIndex: 200,
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "10px 14px 10px 16px",
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
            <span>пункт удалён</span>
            <button
              type="button"
              onClick={undoDelete}
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
              отменить
            </button>
          </div>,
          document.body
        )}

      {/* Kebab-меню пункта: копировать / напомнить / удалить. Portal — мимо
          трансформированного предка (.screen-fade), иначе fixed ломается. */}
      {menuIndex !== null &&
        tasks[menuIndex] &&
        createPortal(
          <BottomSheet onDismiss={() => setMenuIndex(null)}>
            <SheetTitle title="пункт" onClose={() => setMenuIndex(null)} />
            <div style={{ padding: "0 12px 4px" }}>
              <MenuItem
                icon={ExtraIcons.copy}
                label="копировать"
                onClick={() => {
                  copyText(tasks[menuIndex].text);
                  setMenuIndex(null);
                }}
              />
              <MenuItem
                icon={ExtraIcons.calendar}
                label={tasks[menuIndex].deadline ? "изменить дедлайн" : "напомнить"}
                onClick={() => {
                  setDeadlineIndex(menuIndex);
                  setMenuIndex(null);
                }}
              />
              <MenuItem
                icon={ExtraIcons.trash}
                label="удалить"
                danger
                onClick={() => {
                  const i = menuIndex;
                  setMenuIndex(null);
                  editText(i, "");
                }}
              />
            </div>
          </BottomSheet>,
          document.body
        )}

      {/* DS-календарь дедлайна. */}
      {deadlineIndex !== null &&
        tasks[deadlineIndex] &&
        createPortal(
          <DatePickerSheet
            contextText={tasks[deadlineIndex].text || "пункт"}
            value={tasks[deadlineIndex].deadline ?? null}
            onDismiss={() => setDeadlineIndex(null)}
            onConfirm={(iso) => {
              setDeadline(deadlineIndex, iso);
              setDeadlineIndex(null);
            }}
            onClear={() => {
              setDeadline(deadlineIndex, null);
              setDeadlineIndex(null);
            }}
          />,
          document.body
        )}
    </>
  );
}

function MenuItem({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: ReactElement;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        padding: "12px 12px",
        background: "transparent",
        border: "none",
        borderRadius: 12,
        cursor: "pointer",
        textAlign: "left",
        color: danger ? "var(--danger, #C2554D)" : "var(--fg-1)",
        fontFamily: "var(--font-ui)",
        fontSize: 15,
        fontWeight: 500,
        letterSpacing: "-0.01em",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <span style={{ display: "flex", width: 22, height: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {cloneElement(icon, { size: 19, sw: 1.7 } as never)}
      </span>
      {label}
    </button>
  );
}
