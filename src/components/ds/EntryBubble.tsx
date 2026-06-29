/* EntryBubble — одна дописка в ленте заметки (Notes as Conversations, F3a + F3c).
   «Мои» (kind=user) — пузырь справа; ДОЛГОЕ нажатие (long-press) / правый клик →
   нижняя шторка действий (Изменить / Копировать / Удалить), как в Telegram. Тап
   ничего не делает (нет случайной правки). «Изменить» → inline-textarea, авто-сейв
   на blur (как тело заметки). Место под ответы Brain (kind brain/system) слева —
   задел. Статусы голоса: transcribing (распознаётся, без действий) / failed
   (можно вписать текст вручную или удалить). */
import { useEffect, useRef, useState } from "react";
import { Pulse } from "./atoms";
import { EntryActionSheet } from "./EntryActionSheet";
import type { Entry } from "../../lib/api";
import { formatTime } from "../../lib/formatters";

// Долгое нажатие: порог времени и допуск дрожания пальца (больше — это скролл, не press).
const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE_PX = 10;

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
  const [menuOpen, setMenuOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  // Текст, отправленный на сохранение — гард на время запроса (двойной blur не шлёт PATCH дважды).
  const savingRef = useRef<string | null>(null);

  // Long-press: таймер + стартовая позиция пальца (для отмены при скролле).
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressPos = useRef<{ x: number; y: number } | null>(null);

  // Размонтирование (запись удалили / ушли со стека) во время отложенного таймера или
  // запроса правки — гасим таймер и не дёргаем setState на мёртвом компоненте (ревью).
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
      if (pressTimer.current) clearTimeout(pressTimer.current);
    },
    [],
  );

  const clearPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    pressPos.current = null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!interactive || editing) return;
    if (e.pointerType === "mouse" && e.button !== 0) return; // правый клик → onContextMenu
    pressPos.current = { x: e.clientX, y: e.clientY };
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      if (mountedRef.current) setMenuOpen(true);
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = pressPos.current;
    if (!p) return;
    // Палец поехал → это скролл ленты, не долгое нажатие.
    if (Math.abs(e.clientX - p.x) > MOVE_TOLERANCE_PX || Math.abs(e.clientY - p.y) > MOVE_TOLERANCE_PX) {
      clearPress();
    }
  };

  // На тач отмену делают pointermove (порог) / pointercancel; pointerleave на iOS срабатывает
  // у края пузыря даже при неподвижном пальце → не отменяем им долгое нажатие на тач (ревью).
  const onPointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") return;
    clearPress();
  };

  const onContextMenu = (e: React.MouseEvent) => {
    if (!interactive || editing) return;
    e.preventDefault(); // подавляем нативное меню; на десктопе правый клик открывает наше
    clearPress(); // гасим возможный отложенный таймер (Android шлёт contextmenu ~на 500мс)
    if (!menuOpen) setMenuOpen(true);
  };

  const autoGrow = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  const startEdit = () => {
    if (!canEdit) return;
    setDraft(entry.body);
    setEditing(true);
    requestAnimationFrame(() => {
      taRef.current?.focus();
      autoGrow();
    });
  };

  // Авто-сейв на blur (как тело заметки): пусто/без изменений/уже сохраняем → тихо выходим.
  const saveEdit = async () => {
    const next = draft.trim();
    if (!next || next === entry.body.trim() || !onEdit || savingRef.current === next) {
      setEditing(false);
      return;
    }
    savingRef.current = next;
    try {
      await onEdit(entry.id, next);
      // Гард нужен только на время запроса; не сбросив, заблокировали бы повторную правку
      // тем же текстом после стейл-отката поллингом (ревью F3c).
      savingRef.current = null;
      if (mountedRef.current) setEditing(false);
    } catch {
      savingRef.current = null;
      if (mountedRef.current) onToast?.("Не удалось сохранить");
    }
  };

  const remove = async () => {
    if (!onDelete) return;
    try {
      await onDelete(entry.id); // успех → запись исчезнет из ленты (родитель), компонент уйдёт
    } catch {
      onToast?.("Не удалось удалить");
    }
  };

  const copy = () => {
    // clipboard может отсутствовать (HTTP-контекст / старый WebView) — иначе тап по
    // «Копировать» молча ничего не делал бы (нет ни успеха, ни ошибки).
    if (!navigator.clipboard) {
      onToast?.("Копирование недоступно");
      return;
    }
    navigator.clipboard
      .writeText(entry.body)
      .then(() => onToast?.("Скопировано"))
      .catch(() => onToast?.("Не удалось скопировать"));
  };

  return (
    <div style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", padding: "3px 0" }}>
      <div
        style={{
          maxWidth: "82%",
          background: mine ? "rgba(143,168,136,0.18)" : "var(--surface-glass-strong)",
          border: `0.5px solid ${mine ? "rgba(122,156,122,0.28)" : "var(--border-1)"}`,
          borderRadius: 16,
          borderBottomRightRadius: mine ? 5 : 16,
          borderBottomLeftRadius: mine ? 16 : 5,
          padding: "9px 13px 7px",
        }}
      >
        {editing ? (
          <textarea
            ref={taRef}
            value={draft}
            onChange={(e) => {
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
              overflowWrap: "break-word",
              wordBreak: "break-word",
              fontFamily: "var(--font-ui)",
              fontSize: 14.5,
              lineHeight: 1.5,
              color: "var(--fg-1)",
              caretColor: "var(--brand-primary)",
              letterSpacing: "-0.005em",
            }}
          />
        ) : transcribing ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 13.5, color: "var(--fg-3)" }}>
            <Pulse size={7} /> Распознаю голос…
          </span>
        ) : (
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={clearPress}
            onPointerCancel={clearPress}
            onPointerLeave={onPointerLeave}
            onContextMenu={onContextMenu}
            role={interactive ? "button" : undefined}
            tabIndex={interactive ? 0 : undefined}
            aria-haspopup={interactive ? "dialog" : undefined}
            onKeyDown={
              interactive
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setMenuOpen(true);
                    }
                  }
                : undefined
            }
            style={{
              // Долгое нажатие не должно выделять текст / звать нативное iOS-меню.
              userSelect: "none",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
            }}
          >
            {failed ? (
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 13.5, color: "var(--fg-3)" }}>
                🎙 Не удалось распознать{interactive ? " · зажми, чтобы вписать" : ""}
              </span>
            ) : (
              <span style={{ fontFamily: "var(--font-ui)", fontSize: 14.5, color: "var(--fg-1)", lineHeight: 1.5, letterSpacing: "-0.005em", whiteSpace: "pre-wrap", overflowWrap: "break-word", wordBreak: "break-word" }}>
                {entry.body}
              </span>
            )}
          </div>
        )}
        <span style={{ display: "block", textAlign: "right", marginTop: 4, fontFamily: "var(--font-ui)", fontSize: 10.5, color: "var(--fg-4)", letterSpacing: "-0.005em" }}>
          {entry.edited_at ? "изм. · " : ""}
          {formatTime(entry.created_at)}
        </span>
      </div>

      {menuOpen && (
        <EntryActionSheet
          onDismiss={() => setMenuOpen(false)}
          onEdit={canEdit ? () => { setMenuOpen(false); startEdit(); } : undefined}
          onCopy={entry.body.trim() ? () => { setMenuOpen(false); copy(); } : undefined}
          onDelete={canDelete ? () => { setMenuOpen(false); void remove(); } : undefined}
        />
      )}
    </div>
  );
}
