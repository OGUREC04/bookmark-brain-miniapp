/* DatePickerSheet — DS-календарь выбора даты (дедлайн пункта). Обёртка вокруг
   Calendar в BottomSheet. Возвращает дату как "YYYY-MM-DD". */
import { useState } from "react";
import { BottomSheet, SheetTitle, TelegramMainButton } from "./Sheets";
import { Calendar } from "./Calendar";

export function DatePickerSheet({
  contextText,
  value,
  onDismiss,
  onConfirm,
  onClear,
}: {
  contextText: string;
  value: string | null;
  onDismiss?: () => void;
  onConfirm?: (iso: string) => void; // YYYY-MM-DD
  onClear?: () => void;
}) {
  const [sel, setSel] = useState<string | null>(value);
  return (
    <BottomSheet onDismiss={onDismiss}>
      <SheetTitle title="дедлайн" onClose={onDismiss} />
      <div
        style={{
          margin: "0 16px 12px",
          padding: "10px 14px",
          background: "rgba(234,227,207,0.45)",
          border: "1px solid var(--border-1)",
          borderRadius: 14,
          fontFamily: "var(--font-display)",
          fontStyle: "italic",
          fontSize: 13.5,
          color: "var(--fg-2)",
          lineHeight: 1.35,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        «{contextText}»
      </div>

      <div style={{ padding: "0 16px" }}>
        <Calendar value={sel} onSelect={setSel} />
      </div>

      <div style={{ display: "flex", gap: 10, padding: "16px 16px 0" }}>
        {value && (
          <button
            type="button"
            onClick={() => onClear?.()}
            style={{
              flexShrink: 0,
              padding: "0 18px",
              height: 50,
              borderRadius: 16,
              background: "var(--bg-sunken)",
              border: "none",
              color: "var(--fg-2)",
              fontFamily: "var(--font-ui)",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            снять
          </button>
        )}
        <div style={{ flex: 1 }}>
          <TelegramMainButton label="готово" enabled={!!sel} onClick={() => sel && onConfirm?.(sel)} />
        </div>
      </div>
    </BottomSheet>
  );
}
