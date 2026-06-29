/* EntryActionSheet — действия с дописькой по долгому нажатию (long-press) на пузырь:
   Изменить / Копировать / Удалить. Тот же визуал и паттерн, что у ActionSheet заметки
   (нижняя шторка). Telegram-подобное контекстное меню, но снизу — консистентно с
   остальным приложением и надёжно в Telegram WebView. */
import { cloneElement, type ReactElement } from "react";
import { ExtraIcons } from "./icons";
import { BottomSheet } from "./sheetPrimitives";

export function EntryActionSheet({
  onDismiss,
  onEdit,
  onCopy,
  onDelete,
}: {
  onDismiss?: () => void;
  /** undefined → строки нет (запись нельзя править). */
  onEdit?: () => void;
  /** undefined → строки нет (нечего копировать, напр. пустое/нераспознанное тело). */
  onCopy?: () => void;
  onDelete?: () => void;
}) {
  const items: Array<{ id: string; icon: ReactElement; label: string; on?: () => void; danger?: boolean }> = [
    { id: "edit", icon: ExtraIcons.pencil, label: "Изменить", on: onEdit },
    { id: "copy", icon: ExtraIcons.copy, label: "Копировать", on: onCopy },
    { id: "del", icon: ExtraIcons.trash, label: "Удалить", on: onDelete, danger: true },
  ];
  return (
    <BottomSheet onDismiss={onDismiss} ariaLabel="Действия с записью">
      <div style={{ padding: "4px 6px 4px" }}>
        {items
          .filter((it) => it.on)
          .map((it) => (
            <button
              key={it.id}
              onClick={it.on}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                width: "100%",
                padding: "12px 14px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: it.danger ? "var(--semantic-error, #8A2A20)" : "var(--fg-1)",
                textAlign: "left",
              }}
            >
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: it.danger ? "rgba(138,42,32,0.08)" : "rgba(234,227,207,0.55)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: it.danger ? "var(--semantic-error, #8A2A20)" : "var(--brand-primary-press)",
                  flexShrink: 0,
                }}
              >
                {cloneElement(it.icon, { size: 18, sw: 1.6 } as never)}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 500, letterSpacing: "-0.01em" }}>
                {it.label}
              </span>
            </button>
          ))}
      </div>
    </BottomSheet>
  );
}
