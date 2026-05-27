/* Строка добавления нового пункта task-list (дизайн CleanTaskList): пунктирный
   квадрат 20px + italic «+ Добавить пункт» → инлайн-инпут (Enter добавляет и
   держит фокус, Esc/blur пустого отменяет). */
import { useCallback, useEffect, useRef, useState } from "react";
import { MAX_TASK_LEN } from "./taskEditorShared";

export function AddRow({ onAdd }: { onAdd: (text: string) => void }) {
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

  const dashedBox = (
    <span
      style={{
        width: 20,
        height: 20,
        borderRadius: 5,
        border: "1.5px dashed var(--border-2)",
        flexShrink: 0,
        marginTop: 2,
      }}
    />
  );

  return (
    <div
      onClick={() => !active && setActive(true)}
      style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", cursor: "text" }}
    >
      {dashedBox}
      {active ? (
        <input
          ref={inputRef}
          value={draft}
          maxLength={MAX_TASK_LEN}
          placeholder="Новый пункт"
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
            border: "none",
            outline: "none",
            background: "transparent",
            font: "inherit",
            fontSize: 15,
            color: "var(--fg-1)",
            letterSpacing: "-0.005em",
          }}
        />
      ) : (
        <span
          style={{
            flex: 1,
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: 14,
            color: "var(--fg-3)",
            letterSpacing: 0,
            lineHeight: 1.4,
          }}
        >
          + Добавить пункт
        </span>
      )}
    </div>
  );
}
