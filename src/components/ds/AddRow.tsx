/* Строка добавления нового пункта task-list (US-4): плейсхолдер «+ добавить пункт»
   → инлайн-инпут (Enter добавляет и держит фокус, Esc/blur пустого отменяет). */
import { useCallback, useEffect, useRef, useState, cloneElement } from "react";
import { Icons } from "./icons";
import { EDIT_INPUT_STYLE, MAX_TASK_LEN } from "./taskEditorShared";

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

  const leadBox = (
    <span
      style={{
        width: 28,
        height: 28,
        margin: "0 0 0 -5px",
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
        style={EDIT_INPUT_STYLE}
      />
    </div>
  );
}
