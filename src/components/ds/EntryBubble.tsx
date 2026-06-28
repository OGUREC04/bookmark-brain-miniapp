/* EntryBubble — одна дописка в ленте заметки (Notes as Conversations, F3a + F3c).
   «Мои» (kind=user) — пузырь справа; тап → inline-правка (авто-сейв на blur, как тело
   заметки) + удаление. Место под ответы Brain (kind brain/system) слева — задел (в MVP
   Brain молчит). Статусы голос-дописки: transcribing (распознаётся, без действий) /
   failed (можно вписать текст вручную или удалить). */
import { cloneElement, useRef, useState } from "react";
import { Pulse } from "./atoms";
import { ExtraIcons } from "./icons";
import type { Entry } from "../../lib/api";
import { formatTime } from "../../lib/formatters";

export function EntryBubble({
  entry,
  onEdit,
  onDelete,
  onToast,
}: {
  entry: Entry;
  /** Сохранить правку дописки (бэк ставит edited_at). undefined = правка выключена. */
  onEdit?: (id: string, body: string) => Promise<void>;
  /** Удалить дописку (soft-delete). undefined = удаление выключено. */
  onDelete?: (id: string) => Promise<void>;
  onToast?: (msg: string) => void;
}) {
  const mine = entry.kind === "user";
  const transcribing = entry.entry_ai_status === "transcribing";
  const failed = entry.entry_ai_status === "failed";
  // Свои записи можно править/удалять, кроме тех, что ещё распознаются.
  const canEdit = mine && !transcribing && !!onEdit;
  const canDelete = mine && !transcribing && !!onDelete;
  const interactive = canEdit || canDelete;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.body);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  // Текст, уже отправленный на сохранение — чтобы blur+повторный сейв не слали PATCH дважды.
  const savingRef = useRef<string | null>(null);
  // Клик по «Удалить» блюрит текстарею → не даём авто-сейву сработать перед удалением.
  const deletingRef = useRef(false);

  const autoGrow = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const startEdit = () => {
    if (!interactive) return;
    deletingRef.current = false; // вход в правку сбрасывает возможный залипший delete-флаг
    setDraft(entry.body);
    setEditing(true);
    requestAnimationFrame(() => {
      taRef.current?.focus();
      autoGrow();
    });
  };

  // Авто-сейв на blur (как тело заметки): пусто/без изменений/уже сохраняем → тихо выходим.
  const saveEdit = async () => {
    // Идёт удаление — не сохраняем. Сбрасываем флаг и выходим из правки, чтобы оборванный
    // delete-жест (mousedown без click, частый на тач-скролле) не залип навсегда, блокируя
    // авто-сейв (ревью F3c).
    if (deletingRef.current) {
      deletingRef.current = false;
      setEditing(false);
      return;
    }
    const next = draft.trim();
    if (!next || next === entry.body.trim() || !onEdit || savingRef.current === next) {
      setEditing(false);
      return;
    }
    savingRef.current = next;
    try {
      await onEdit(entry.id, next);
      // дедуп-гард нужен только на время запроса; не сбросив, заблокировали бы повторную
      // правку тем же текстом после стейл-отката поллингом (ревью F3c).
      savingRef.current = null;
      setEditing(false);
    } catch {
      savingRef.current = null;
      onToast?.("Не удалось сохранить");
    }
  };

  const remove = async () => {
    if (!onDelete) return;
    try {
      await onDelete(entry.id); // успех → запись исчезнет из ленты (родитель), компонент уйдёт
    } catch {
      deletingRef.current = false;
      onToast?.("Не удалось удалить");
    }
  };

  const bubbleStyle = {
    maxWidth: "82%",
    background: mine ? "rgba(143,168,136,0.18)" : "var(--surface-glass-strong)",
    border: `0.5px solid ${mine ? "rgba(122,156,122,0.28)" : "var(--border-1)"}`,
    borderRadius: 16,
    borderBottomRightRadius: mine ? 5 : 16,
    borderBottomLeftRadius: mine ? 16 : 5,
    padding: "9px 13px 7px",
  } as const;

  const metaStyle = {
    display: "block",
    textAlign: "right",
    marginTop: 4,
    fontFamily: "var(--font-ui)",
    fontSize: 10.5,
    color: "var(--fg-4)",
    letterSpacing: "-0.005em",
  } as const;

  return (
    <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", padding: "3px 0" }}>
      <div style={bubbleStyle}>
        {editing ? (
          <>
            <textarea
              ref={taRef}
              value={draft}
              onChange={(e) => {
                deletingRef.current = false; // печатает → не удаляет (страховка от залипшего флага)
                setDraft(e.target.value);
                autoGrow();
              }}
              onBlur={saveEdit}
              aria-label="текст дописки"
              placeholder={failed ? "Впиши текст вручную…" : "Текст дописки…"}
              rows={1}
              style={{
                width: "100%",
                minWidth: 180,
                boxSizing: "border-box",
                border: "none",
                background: "transparent",
                padding: 0,
                outline: "none",
                resize: "none",
                overflow: "hidden",
                fontFamily: "var(--font-ui)",
                fontSize: 14.5,
                lineHeight: 1.5,
                color: "var(--fg-1)",
                caretColor: "var(--brand-primary)",
                letterSpacing: "-0.005em",
              }}
            />
            {canDelete && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                <button
                  type="button"
                  aria-label="удалить дописку"
                  // mousedown раньше blur: фиксируем «удаляю» и держим фокус, чтобы blur-сейв не сработал.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    deletingRef.current = true;
                  }}
                  onClick={() => void remove()}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    color: "var(--semantic-error, #B5483A)",
                    fontFamily: "var(--font-ui)",
                    fontSize: 12,
                    fontWeight: 500,
                    letterSpacing: "-0.005em",
                    cursor: "pointer",
                  }}
                >
                  {cloneElement(ExtraIcons.trash, { size: 13, sw: 1.7 } as never)}
                  Удалить
                </button>
              </div>
            )}
          </>
        ) : transcribing ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 13.5, color: "var(--fg-3)" }}>
            <Pulse size={7} /> Распознаю голос…
          </span>
        ) : (
          <div
            onClick={interactive ? startEdit : undefined}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            onKeyDown={
              interactive
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      startEdit();
                    }
                  }
                : undefined
            }
            style={{ cursor: interactive ? "text" : "default" }}
          >
            {failed ? (
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 13.5, color: "var(--fg-3)" }}>
                🎙 Не удалось распознать{interactive ? " · нажми, чтобы вписать" : ""}
              </span>
            ) : (
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 14.5, color: "var(--fg-1)", lineHeight: 1.5, letterSpacing: "-0.005em", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {entry.body}
              </span>
            )}
          </div>
        )}
        <span style={metaStyle}>
          {entry.edited_at ? "изм. · " : ""}
          {formatTime(entry.created_at)}
        </span>
      </div>
    </div>
  );
}
