/* Bottom Sheets — ported 1:1 from docs/design-system-miniapp/app/Sheets.jsx.
   Visual inline styles verbatim; data wired via props.
   Shared primitives used across all sheets. */
import { useState, useEffect, cloneElement, type ReactNode } from "react";
import { Icons } from "./icons";

export function BottomSheet({
  children,
  onDismiss,
  paddingBottom = 24,
  height = "auto",
}: {
  children: ReactNode;
  onDismiss?: () => void;
  paddingBottom?: number;
  height?: string;
}) {
  // Залочить скролл фона пока шторка открыта (иначе подложка скроллится под ней).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <>
      <div
        onClick={onDismiss}
        onTouchMove={(e) => e.preventDefault()}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--bg-overlay, rgba(28,22,18,0.32))",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          zIndex: 100,
          touchAction: "none",
        }}
      />
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 101,
          height,
          animation: "sheetUp 320ms var(--ease-out) both",
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          style={{
            background: "rgba(255,252,246,0.92)",
            backdropFilter: "blur(32px) saturate(160%)",
            WebkitBackdropFilter: "blur(32px) saturate(160%)",
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderTop: "1px solid rgba(255,255,255,0.7)",
            padding: `6px 0 ${paddingBottom}px`,
            boxShadow: "0 -8px 30px rgba(60,40,25,0.12), 0 1px 0 rgba(255,255,255,0.6) inset",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center", padding: "6px 0 10px" }}>
            <div style={{ width: 38, height: 4, borderRadius: 999, background: "var(--border-strong, #C9C0AC)" }} />
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

export function SheetTitle({
  title,
  right,
  onClose,
  onBack,
}: {
  title: ReactNode;
  right?: ReactNode;
  /** Закрыть шторку целиком (×, справа). */
  onClose?: () => void;
  /** Шаг назад в флоу (‹ шеврон, слева). */
  onBack?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: onBack ? "4px 16px 14px 12px" : "4px 16px 14px 20px",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
        {onBack && <SheetBackBtn onClick={onBack} />}
        <h3 style={{ fontSize: 20, fontWeight: 500, letterSpacing: "-0.025em", color: "var(--fg-1)", margin: 0, minWidth: 0 }}>
          {title}
        </h3>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {right && (
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", letterSpacing: ".06em", fontWeight: 500 }}>
            {right}
          </span>
        )}
        {onClose && <SheetCloseBtn onClick={onClose} />}
      </div>
    </div>
  );
}

export function SheetBackBtn({ onClick }: { onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button
      type="button"
      aria-label="назад"
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        width: 32,
        height: 32,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: h ? "var(--bg-sunken)" : "transparent",
        border: "none",
        borderRadius: 999,
        color: h ? "var(--fg-1)" : "var(--fg-2)",
        cursor: "pointer",
        transition: "color 140ms var(--ease-out), background 140ms var(--ease-out)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {cloneElement(Icons.chevronLeft, { size: 20, sw: 2 } as never)}
    </button>
  );
}

export function SheetCloseBtn({ onClick, label = "закрыть" }: { onClick: () => void; label?: string }) {
  const [h, setH] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        width: 30,
        height: 30,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: h ? "var(--bg-sunken)" : "var(--bg-sunken, rgba(234,227,207,0.5))",
        border: "none",
        borderRadius: 999,
        color: h ? "var(--fg-1)" : "var(--fg-3)",
        cursor: "pointer",
        transition: "color 140ms var(--ease-out)",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {cloneElement(Icons.close, { size: 15, sw: 1.8 } as never)}
    </button>
  );
}

export function TelegramMainButton({
  label,
  enabled,
  onClick,
  disabledHint,
}: {
  label: string;
  enabled: boolean;
  onClick?: () => void;
  /** Подсказка почему кнопка недоступна — нативный tooltip + текст под кнопкой. */
  disabledHint?: string;
}) {
  return (
    <div>
      <button
        disabled={!enabled}
        onClick={onClick}
        title={!enabled ? disabledHint : undefined}
        style={{
          width: "100%",
          padding: "14px 18px",
          borderRadius: 14,
          background: enabled ? "var(--brand-primary)" : "rgba(122,156,122,0.35)",
          color: "var(--fg-on-brand)",
          border: "none",
          fontFamily: "var(--font-ui)",
          fontSize: 15,
          fontWeight: 500,
          letterSpacing: "-0.005em",
          cursor: enabled ? "pointer" : "not-allowed",
          boxShadow: enabled
            ? "0 1px 0 rgba(255,255,255,0.2) inset, 0 4px 12px rgba(122,156,122,0.25)"
            : "none",
        }}
      >
        {label}
      </button>
      {!enabled && disabledHint && (
        <div
          style={{
            marginTop: 8,
            textAlign: "center",
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontSize: 12.5,
            color: "var(--fg-3)",
            letterSpacing: 0,
          }}
        >
          {disabledHint}
        </div>
      )}
    </div>
  );
}
