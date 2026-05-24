/* Строка пункта task-list: чекбокс (тоггл) + текст (тап → инлайн-редактирование)
   + действия copy/очистить(×) на ховере/фокусе. См. TaskListEditor. */
import { useCallback, useEffect, useRef, useState, cloneElement, type ReactElement } from "react";
import { Icons, ExtraIcons } from "./icons";
import type { TaskItem } from "../../lib/api";
import { EDIT_INPUT_STYLE, MAX_TASK_LEN } from "./taskEditorShared";

/** "2026-05-16" → "16.05" (дедлайн — дата без времени, время 09:00 ставит бэк). */
function fmtDeadline(iso: string): string {
  const [, m, d] = iso.split("-");
  return d && m ? `${d}.${m}` : iso;
}

export function TaskRow({
  task,
  index,
  onToggle,
  onEdit,
  onMenu,
  onOpenDeadline,
  onClearDeadline,
}: {
  task: TaskItem;
  index: number;
  onToggle: () => void;
  onEdit: (text: string) => void;
  /** Открыть kebab-меню (копировать / удалить / напомнить). */
  onMenu: () => void;
  /** Открыть DS-календарь для дедлайна пункта. */
  onOpenDeadline: () => void;
  /** Снять дедлайн (× на чипе). */
  onClearDeadline: () => void;
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
          style={EDIT_INPUT_STYLE}
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

      {/* Чип дедлайна — виден всегда когда дедлайн есть; тап → пере-выбор, × → снять. */}
      {task.deadline && (
        <span
          style={{
            alignSelf: "flex-end",
            display: "inline-flex",
            alignItems: "center",
            gap: 2,
            flexShrink: 0,
            padding: "1px 3px 1px 7px",
            borderRadius: 999,
            background: "var(--bg-sunken)",
            color: "var(--fg-2)",
          }}
        >
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onOpenDeadline}
            aria-label={`дедлайн пункта ${index + 1}: ${task.deadline}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "inherit",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: ".02em",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {cloneElement(ExtraIcons.calendar, { size: 12, sw: 1.6 } as never)}
            {fmtDeadline(task.deadline)}
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClearDeadline}
            aria-label={`снять дедлайн пункта ${index + 1}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 16,
              height: 16,
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "var(--fg-3)",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {cloneElement(Icons.close, { size: 11, sw: 1.8 } as never)}
          </button>
        </span>
      )}

      {/* Действия: очистить(×) + меню(⋮). Видны на ховере/фокусе, прибиты к низу. */}
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
          icon={Icons.close}
          label={`очистить пункт ${index + 1}`}
          disabled={!hasText}
          onClick={clearText}
        />
        <IconBtn icon={ExtraIcons.kebab} label={`меню пункта ${index + 1}`} onClick={onMenu} />
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
