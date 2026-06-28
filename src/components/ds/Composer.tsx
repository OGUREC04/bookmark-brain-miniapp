/* Composer — переиспользуемая строка ввода (текст + слот слева + отправка).
   Вынесено из ComposeScreen (F2). Авто-рост textarea, расширение при длинном
   тексте (кнопки уходят вниз — паттерн Meta/Gemini). Запись голоса/вложение —
   через слот `lead` (проп); сам Composer про них не знает. Используется в
   ComposeScreen (lead = 📎+🎤) и в ленте заметки для дописок (F3b, без lead). */
import { cloneElement, useEffect, useRef, type ReactNode } from "react";
import { canSend, shouldExpandComposer } from "../../lib/compose";
import { ExtraIcons } from "./icons";

// Потолок высоты поля (≈10 строк). Заметки длиннее чата (Messenger/WhatsApp ~4-5
// строк), поэтому выше; дальше — внутренний скролл. Источник: CSS-Tricks autogrow.
const MAX_TEXTAREA_PX = 240;

export function Composer({
  value,
  onChange,
  onSend,
  sending = false,
  placeholder = "Мысль или ссылка…",
  lead,
  autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  /** Идёт отправка — блокирует кнопку (как saving в ComposeScreen). */
  sending?: boolean;
  placeholder?: string;
  /** Контент слота слева (📎/🎤). Нет слота → грид без левой колонки. */
  lead?: ReactNode;
  autoFocus?: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const sendEnabled = canSend(value, sending);
  // Расширение (кнопки вниз) имеет смысл только когда слева есть слот; без него
  // строка всегда однорядная (textarea растёт, отправка справа).
  const expanded = !!lead && shouldExpandComposer(value);

  // Авто-рост textarea под текст (до предела), без фикс. rows.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
    // Скролл — ТОЛЬКО когда текст реально не влезает в потолок. Иначе hidden:
    // постоянный overflowY:auto давал полосу преждевременно (округление scrollHeight).
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_PX ? "auto" : "hidden";
  }, [value]);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: lead ? "auto 1fr auto" : "1fr auto",
        gridTemplateAreas: lead
          ? expanded
            ? '"input input input" "lead . send"'
            : '"lead input send"'
          : '"input send"',
        alignItems: "center",
        gap: 8,
        background: "var(--bg-surface)",
        border: "1px solid var(--border-1)",
        borderRadius: 22,
        padding: 8,
        boxShadow: "var(--shadow-2)",
      }}
    >
      {lead && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, gridArea: "lead" }}>
          {lead}
        </div>
      )}

      <textarea
        ref={taRef}
        className="compose-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        rows={1}
        style={{
          gridArea: "input",
          width: "100%",
          minWidth: 0,
          boxSizing: "border-box",
          maxHeight: MAX_TEXTAREA_PX,
          overflowY: "hidden", // эффект включит "auto" только при переполнении
          border: "none",
          outline: "none",
          resize: "none",
          background: "transparent",
          fontFamily: "var(--font-ui)",
          fontSize: 16,
          color: "var(--fg-1)",
          lineHeight: 1.45,
          letterSpacing: "-0.005em",
          padding: expanded ? "6px 6px 2px" : "0 4px",
        }}
      />

      <button
        type="button"
        aria-label="отправить"
        onClick={onSend}
        disabled={!sendEnabled}
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          gridArea: "send",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--brand-primary)",
          border: "none",
          color: "var(--fg-on-brand)",
          opacity: sendEnabled ? 1 : 0.4,
          boxShadow: sendEnabled ? "var(--shadow-fab)" : "none",
          cursor: sendEnabled ? "pointer" : "not-allowed",
          transition: "opacity 160ms var(--ease-out)",
        }}
      >
        {cloneElement(ExtraIcons.send, { size: 20, sw: 1.7 } as never)}
      </button>
    </div>
  );
}
