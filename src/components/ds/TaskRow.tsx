/* Строка пункта task-list — Things3/Craft-стиль (дизайн CleanTaskRow):
   плоская строка, чекбокс 20px, тап по тексту → underline-edit, дедлайн-чип
   под текстом (overdue → красный), ⋮-меню на ховере/фокусе.
   Удаление/копирование/напомнить — через ⋮ (TaskListEditor); снятие дедлайна —
   кнопка «снять» в DS-календаре. См. TaskListEditor. */
import { useCallback, useEffect, useRef, useState, cloneElement } from "react";
import { Icons, ExtraIcons } from "./icons";
import type { TaskItem } from "../../lib/api";
import { MAX_TASK_LEN } from "./taskEditorShared";

/** "2026-05-16" → "16.05". */
function fmtDeadline(iso: string): string {
  const [, m, d] = iso.split("-");
  return d && m ? `${d}.${m}` : iso;
}

/** Дедлайн в прошлом и пункт не выполнен. */
function isOverdue(deadline: string, done: boolean): boolean {
  if (done) return false;
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return deadline < todayISO;
}

export function TaskRow({
  task,
  index,
  onToggle,
  onEdit,
  onMenu,
  onOpenDeadline,
}: {
  task: TaskItem;
  index: number;
  onToggle: () => void;
  onEdit: (text: string) => void;
  /** Открыть kebab-меню (копировать / напомнить / удалить). */
  onMenu: () => void;
  /** Открыть DS-календарь дедлайна (снятие — через «снять» внутри). */
  onOpenDeadline: () => void;
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

  const showActions = hovered || editing;
  const overdue = task.deadline ? isOverdue(task.deadline, task.done) : false;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0" }}
    >
      {/* checkbox 20px */}
      <button
        type="button"
        onClick={onToggle}
        role="checkbox"
        aria-checked={task.done}
        aria-label={`отметить пункт ${index + 1}`}
        style={{
          width: 20,
          height: 20,
          borderRadius: 5,
          border: task.done ? "none" : "1.5px solid var(--border-2)",
          background: task.done ? "var(--brand-primary)" : "transparent",
          color: "var(--fg-on-brand)",
          cursor: "pointer",
          flexShrink: 0,
          marginTop: 2,
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "background 200ms var(--ease-out)",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {task.done && cloneElement(Icons.check, { size: 11, sw: 2.5 } as never)}
      </button>

      {/* text + deadline chip */}
      <div style={{ flex: 1, minWidth: 0 }}>
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
              width: "100%",
              border: "none",
              borderBottom: "1px solid var(--brand-primary)",
              outline: "none",
              background: "transparent",
              padding: "0 0 2px",
              borderRadius: 0,
              font: "inherit",
              fontSize: 15,
              color: "var(--fg-1)",
              letterSpacing: "-0.005em",
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
              display: "block",
              fontSize: 15,
              color: task.done ? "var(--fg-3)" : "var(--fg-1)",
              textDecoration: task.done ? "line-through" : "none",
              textDecorationColor: "var(--fg-3)",
              lineHeight: 1.4,
              letterSpacing: "-0.005em",
              cursor: "text",
              wordBreak: "break-word",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {task.text}
          </span>
        )}

        {task.deadline && !editing && (
          <button
            type="button"
            onClick={onOpenDeadline}
            aria-label={`дедлайн пункта ${index + 1}: ${task.deadline}`}
            style={{
              marginTop: 4,
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px 2px 6px",
              borderRadius: 999,
              background: overdue ? "rgba(196,80,60,0.10)" : "var(--brand-primary-tint)",
              border: `1px solid ${overdue ? "rgba(196,80,60,0.25)" : "rgba(122,156,122,0.25)"}`,
              color: overdue ? "#C2554D" : "var(--brand-primary-press)",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              fontWeight: 500,
              letterSpacing: ".02em",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {cloneElement(ExtraIcons.calendar, { size: 11, sw: 1.7 } as never)}
            <span>{fmtDeadline(task.deadline)}</span>
          </button>
        )}
      </div>

      {/* kebab ⋮ — на ховере/фокусе */}
      <button
        type="button"
        aria-label={`меню пункта ${index + 1}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onMenu}
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          border: "none",
          background: "transparent",
          color: "var(--fg-4)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          marginTop: 1,
          flexShrink: 0,
          opacity: showActions ? 1 : 0,
          pointerEvents: showActions ? "auto" : "none",
          transition: "opacity 160ms var(--ease-out)",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {cloneElement(ExtraIcons.kebab, { size: 16, sw: 1.7 } as never)}
      </button>
    </div>
  );
}
