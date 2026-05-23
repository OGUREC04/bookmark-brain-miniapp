/* Интерактивный редактор task-list для DetailScreen.
   PRD: docs/prd/TASK-LIST-EDITING.md (в монорепо bookmark-brain).
   US-1: тоггл чекбокса. US-2: редактирование текста пункта (тап по тексту →
   input, Enter/blur сохр., Esc отмена, пустой → удаление, лимит 280).
   Дальше: US-3 (delete+undo), US-4 (add), US-5 (deadline).
   Все мутации — optimistic + debounce 400мс, revert при ошибке. */
import { useCallback, useEffect, useRef, useState, cloneElement, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { Icons, ExtraIcons } from "./icons";
import { api, type Bookmark, type TaskItem } from "../../lib/api";
import { hapticSelection, hapticNotify } from "../../lib/telegram";

const COMMIT_DEBOUNCE_MS = 400;
const MAX_TASK_LEN = 280;

function extractTasks(b: Bookmark): TaskItem[] {
  return b.structured_data?.type === "task_list" ? b.structured_data.tasks : [];
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

  // US-4: добавить новый пункт в конец списка.
  const addTask = useCallback(
    (raw: string) => {
      const text = raw.trim().slice(0, MAX_TASK_LEN);
      if (!text) return;
      const next = [...tasksRef.current, { text, done: false, deadline: null }];
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
            key={i}
            task={t}
            index={i}
            onToggle={() => toggle(i)}
            onEdit={(text) => editText(i, text)}
            onCopy={() => copyText(t.text)}
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
    </>
  );
}

function TaskRow({
  task,
  index,
  onToggle,
  onEdit,
  onCopy,
}: {
  task: TaskItem;
  index: number;
  onToggle: () => void;
  onEdit: (text: string) => void;
  onCopy: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.text);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const committedRef = useRef(false);

  const startEdit = useCallback(() => {
    setDraft(task.text);
    committedRef.current = false;
    setEditing(true);
  }, [task.text]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commitEdit = useCallback(() => {
    if (committedRef.current) return; // не дублировать (Enter затем blur)
    committedRef.current = true;
    setEditing(false);
    onEdit(draft);
  }, [draft, onEdit]);

  const cancelEdit = useCallback(() => {
    committedRef.current = true;
    setEditing(false);
    setDraft(task.text);
  }, [task.text]);

  // × — очистить текст и оставить фокус в поле (Enter/blur пустого → удаление пункта).
  const clearText = useCallback(() => {
    committedRef.current = false;
    setDraft("");
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const currentText = editing ? draft : task.text;
  const hasText = currentText.trim().length > 0;
  const showActions = hovered || editing;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "5px 4px",
        borderRadius: 8,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        role="checkbox"
        aria-checked={task.done}
        aria-label={`отметить пункт ${index + 1}`}
        style={{
          // зона тапа ~28×28 вокруг визуального чекбокса 18px (PRD §4)
          width: 28,
          height: 28,
          margin: "-4px 0 0 -5px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: "pointer",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <span
          style={{
            width: 18,
            height: 18,
            borderRadius: 6,
            border: task.done ? "none" : "1.5px solid var(--border-strong)",
            background: task.done ? "var(--brand-primary)" : "transparent",
            color: "var(--fg-on-brand)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 140ms var(--ease-out), border-color 140ms var(--ease-out)",
          }}
        >
          {task.done && cloneElement(Icons.check, { size: 11, sw: 2.5 } as never)}
        </span>
      </button>

      {editing ? (
        <input
          ref={inputRef}
          className="task-edit-input"
          value={draft}
          maxLength={MAX_TASK_LEN}
          aria-label={`редактировать пункт ${index + 1}`}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitEdit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancelEdit();
            }
          }}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 14.5,
            lineHeight: 1.4,
            fontFamily: "inherit",
            color: "var(--fg-1)",
            background: "var(--bg-surface-elev)",
            border: "1px solid var(--border-2)",
            borderRadius: 6,
            padding: "1px 6px",
            margin: "-2px -7px",
            outline: "none",
          }}
        />
      ) : (
        <span
          onClick={startEdit}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              startEdit();
            }
          }}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 14.5,
            color: task.done ? "var(--fg-3)" : "var(--fg-1)",
            textDecoration: task.done ? "line-through" : "none",
            lineHeight: 1.4,
            cursor: "text",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          {task.text}
        </span>
      )}

      {/* Действия: copy + очистить(×). Видны на ховере/фокусе, прибиты к низу. */}
      <div
        style={{
          alignSelf: "flex-end",
          display: "flex",
          gap: 2,
          flexShrink: 0,
          opacity: showActions ? 1 : 0,
          pointerEvents: showActions ? "auto" : "none",
          transition: "opacity 140ms var(--ease-out)",
        }}
      >
        <IconBtn
          icon={ExtraIcons.copy}
          label={`скопировать пункт ${index + 1}`}
          disabled={!hasText}
          onClick={onCopy}
        />
        <IconBtn
          icon={Icons.close}
          label={`очистить пункт ${index + 1}`}
          disabled={!hasText}
          onClick={clearText}
        />
      </div>
    </div>
  );
}

function IconBtn({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: ReactElement;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      // preventDefault на mousedown — не сбрасывать фокус инпута при клике по иконке
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{
        width: 26,
        height: 26,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        borderRadius: 6,
        padding: 0,
        cursor: disabled ? "default" : "pointer",
        color: "var(--fg-3)",
        opacity: disabled ? 0.3 : 1,
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {cloneElement(icon, { size: 15, sw: 1.7 } as never)}
    </button>
  );
}

// US-4: строка добавления нового пункта.
function AddRow({ onAdd }: { onAdd: (text: string) => void }) {
  const [active, setActive] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (active) inputRef.current?.focus();
  }, [active]);

  // Enter — добавить и остаться в режиме для следующего пункта.
  const submitKeep = useCallback(() => {
    const t = draft.trim();
    if (!t) return;
    onAdd(t);
    setDraft("");
    inputRef.current?.focus();
  }, [draft, onAdd]);

  // blur — добавить если есть текст, затем закрыть; пустой → отмена.
  const submitClose = useCallback(() => {
    const t = draft.trim();
    if (t) onAdd(t);
    setDraft("");
    setActive(false);
  }, [draft, onAdd]);

  const cancel = useCallback(() => {
    setDraft("");
    setActive(false);
  }, []);

  const leadBox = (
    <span
      style={{
        width: 28,
        height: 28,
        margin: "-4px 0 0 -5px",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--fg-3)",
      }}
    >
      {cloneElement(Icons.plus, { size: 15, sw: 1.8 } as never)}
    </span>
  );

  if (!active) {
    return (
      <button
        type="button"
        onClick={() => setActive(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          textAlign: "left",
          background: "transparent",
          border: "none",
          padding: "5px 4px",
          margin: 0,
          borderRadius: 8,
          cursor: "pointer",
          color: "var(--fg-3)",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {leadBox}
        <span style={{ fontSize: 14.5, lineHeight: 1.4 }}>добавить пункт</span>
      </button>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 4px", borderRadius: 8 }}>
      {leadBox}
      <input
        ref={inputRef}
        className="task-edit-input"
        value={draft}
        maxLength={MAX_TASK_LEN}
        placeholder="новый пункт"
        aria-label="новый пункт"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={submitClose}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submitKeep();
          } else if (e.key === "Escape") {
            e.preventDefault();
            cancel();
          }
        }}
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 14.5,
          lineHeight: 1.4,
          fontFamily: "inherit",
          color: "var(--fg-1)",
          background: "var(--bg-surface-elev)",
          border: "1px solid var(--border-2)",
          borderRadius: 6,
          padding: "1px 6px",
          margin: "-2px -7px",
          outline: "none",
        }}
      />
    </div>
  );
}
