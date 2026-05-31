/* QuickCreateSheet — FAB+ (functional). Ported 1:1; styles verbatim. */
import { useState, cloneElement } from "react";
import { ExtraIcons } from "./icons";
import { BottomSheet, SheetTitle, TelegramMainButton } from "./sheetPrimitives";

export function QuickCreateSheet({
  onDismiss,
  onSave,
}: {
  onDismiss?: () => void;
  onSave?: (text: string) => void | Promise<void>;
}) {
  const [v, setV] = useState("");
  const [saving, setSaving] = useState(false);
  const enabled = v.trim().length > 0 && !saving;

  const save = async () => {
    if (!enabled) return;
    setSaving(true);
    try {
      await onSave?.(v.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet onDismiss={onDismiss}>
      <SheetTitle title="новая мысль" right="бот разберёт сам" onClose={onDismiss} />

      <div style={{ padding: "0 16px" }}>
        <div
          style={{
            background: "rgba(255,252,246,0.85)",
            border: "1px solid rgba(255,255,255,0.7)",
            borderRadius: 18,
            padding: "14px 16px",
            boxShadow: "0 1px 0 rgba(255,255,255,0.6) inset, 0 4px 12px rgba(60,40,25,0.05)",
            minHeight: 110,
            position: "relative",
          }}
        >
          {!v && (
            <span
              style={{
                position: "absolute",
                fontFamily: "var(--font-display)",
                fontStyle: "italic",
                fontSize: 16,
                color: "var(--fg-3)",
                lineHeight: 1.4,
                letterSpacing: 0,
                pointerEvents: "none",
              }}
            >
              пиши мысль · вставь ссылку · бот разберёт сам
            </span>
          )}
          <textarea
            value={v}
            onChange={(e) => setV(e.target.value)}
            autoFocus
            rows={3}
            style={{
              width: "100%",
              border: "none",
              outline: "none",
              resize: "none",
              background: "transparent",
              font: "inherit",
              fontSize: 16,
              color: "var(--fg-1)",
              lineHeight: 1.4,
              letterSpacing: "-0.005em",
            }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 4px 6px" }}>
          <button
            aria-label="вложение"
            disabled
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              background: "rgba(234,227,207,0.4)",
              border: "1px solid var(--border-1)",
              color: "var(--fg-4)",
              cursor: "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {cloneElement(ExtraIcons.paperclip, { size: 16, sw: 1.6 } as never)}
          </button>
          <button
            aria-label="голос"
            disabled
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              background: "rgba(234,227,207,0.4)",
              border: "1px solid var(--border-1)",
              color: "var(--fg-4)",
              cursor: "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {cloneElement(ExtraIcons.mic, { size: 16, sw: 1.6 } as never)}
          </button>
          <span
            style={{
              flex: 1,
              fontFamily: "var(--font-display)",
              fontStyle: "italic",
              fontSize: 12,
              color: "var(--fg-3)",
              letterSpacing: 0,
            }}
          >
            вложения — в боте
          </span>
        </div>

        <div style={{ marginTop: 8 }}>
          <TelegramMainButton label={saving ? "сохраняю…" : "сохранить"} enabled={enabled} onClick={save} />
        </div>
      </div>
    </BottomSheet>
  );
}
