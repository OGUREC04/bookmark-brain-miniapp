/* ChatRow + DaySeparator — дизайн ui_kits/mini_app/ChatRow.jsx (variant A):
   typed-аватар для системных видов (список/голос), archive — мягкий градиент,
   нет разделителей, padding 14×16, gap 7 title↔preview, preview = UI-sans. */
import { cloneElement, type ReactNode, type CSSProperties } from "react";
import { Icons, ExtraIcons } from "./icons";
import { Glyph, Pulse } from "./atoms";

export type AvatarTone = "sage" | "honey" | "slate" | "plum" | "clay" | "moss";

export const avatarGradients: Record<AvatarTone, string> = {
  sage: "linear-gradient(135deg, #8FA888 0%, #4A6648 100%)",
  honey: "linear-gradient(135deg, #DAC8B0 0%, #B8946A 100%)",
  slate: "linear-gradient(135deg, #9BB0BE 0%, #4F6A7A 100%)",
  plum: "linear-gradient(135deg, #B5A8C0 0%, #6E5A80 100%)",
  clay: "linear-gradient(135deg, #D9907F 0%, #A04934 100%)",
  moss: "linear-gradient(135deg, #B0C28E 0%, #6E8444 100%)",
};

/** outline tone для typed-аватара */
const typedTone: Record<string, string> = {
  sage: "#3F6B4B",
  clay: "#8A4A30",
  honey: "#7A5828",
};

export interface AvatarSpec {
  kind?: "letter" | "typed" | "brain" | "task" | "archive" | "icon";
  tone?: AvatarTone;
  letter?: string;
  glyph?: string;
  icon?: ReactNode;
  size?: number;
}

export function Avatar({ kind = "letter", tone = "sage", letter = "B", glyph, icon, size = 46 }: AvatarSpec) {
  const base: CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 1px 0 rgba(255,255,255,0.4) inset, 0 2px 6px rgba(60,40,25,0.06)",
  };

  // typed — кольцо + Lora-italic категорийная буква (список/голос/напоминание)
  if (kind === "typed" || kind === "task") {
    const ring = typedTone[tone] || typedTone.sage;
    return (
      <div
        style={{
          ...base,
          background: "rgba(255,252,246,0.6)",
          border: `1.5px solid ${ring}`,
          color: ring,
          fontFamily: "var(--font-display)",
          fontStyle: "italic",
          fontWeight: 500,
          fontSize: Math.round(size * 0.46),
          letterSpacing: "-0.02em",
          lineHeight: 1,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
        }}
      >
        {letter}
      </div>
    );
  }

  if (kind === "brain") {
    return (
      <div style={{ ...base, background: "#fff", border: "1px solid rgba(255,255,255,0.6)" }}>
        <Glyph ch={glyph || "✦"} size={Math.round(size * 0.52)} />
      </div>
    );
  }

  // archive — мягкий градиент вместо пунктира
  if (kind === "archive") {
    return (
      <div style={{ ...base, background: "linear-gradient(135deg, #DBD6CB, #C6BFB1)", color: "rgba(60,56,48,0.55)", opacity: 0.85 }}>
        {cloneElement(Icons.archive, { size: Math.round(size * 0.45), sw: 1.4 } as never)}
      </div>
    );
  }

  if (kind === "icon") {
    return (
      <div style={{ ...base, background: avatarGradients[tone] || avatarGradients.sage, color: "#fff" }}>{icon}</div>
    );
  }

  // letter (default) — градиент + белая Lora-italic буква
  return (
    <div
      style={{
        ...base,
        background: avatarGradients[tone] || avatarGradients.sage,
        color: tone === "honey" ? "#2B1F12" : "#fff",
        fontFamily: "var(--font-display)",
        fontStyle: "italic",
        fontWeight: 500,
        fontSize: Math.round(size * 0.46),
        letterSpacing: "-0.01em",
        lineHeight: 1,
      }}
    >
      {letter}
    </div>
  );
}

export interface ChatRowProps {
  avatar: AvatarSpec;
  name: ReactNode;
  time: ReactNode;
  timeNow?: boolean;
  pinned?: boolean;
  preview?: ReactNode;
  src?: string;
  unread?: boolean;
  badge?: number | string | null;
  star?: boolean;
  pulsing?: boolean;
  done?: boolean;
  muted?: boolean;
  onClick?: () => void;
  onMore?: () => void;
}

export function ChatRow({
  avatar,
  name,
  time,
  timeNow = false,
  pinned = false,
  preview,
  src,
  unread = false,
  badge = null,
  star = false,
  pulsing = false,
  done = false,
  muted = false,
  onClick,
  onMore,
}: ChatRowProps) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 14,
        padding: "14px 16px",
        cursor: "pointer",
        position: "relative",
        borderRadius: 14,
        transition: "background 160ms var(--ease-out)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,252,246,0.45)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {unread && (
        <span
          style={{
            position: "absolute",
            left: 6,
            top: "50%",
            transform: "translateY(-50%)",
            width: 3,
            height: 22,
            borderRadius: 2,
            background: "var(--brand-primary)",
          }}
        />
      )}

      <Avatar {...avatar} />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 7, paddingTop: 1 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 15,
              fontWeight: 500,
              letterSpacing: "-0.01em",
              color: muted ? "var(--fg-3)" : "var(--fg-1)",
              flex: 1,
              minWidth: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              lineHeight: 1.2,
            }}
          >
            {name}
          </span>
          {pinned && (
            <span style={{ color: "var(--fg-3)", transform: "rotate(40deg)", flexShrink: 0, display: "flex" }}>
              {cloneElement(Icons.pin, { size: 13, sw: 1.6 } as never)}
            </span>
          )}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: timeNow ? "var(--brand-primary)" : "var(--fg-3)",
              letterSpacing: ".04em",
              flexShrink: 0,
            }}
          >
            {time}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: "var(--font-ui)",
              fontSize: 13.5,
              fontWeight: 400,
              color: muted ? "var(--fg-4)" : "var(--fg-2)",
              lineHeight: 1.4,
              letterSpacing: "-0.005em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {done && (
              <span style={{ display: "inline-flex", verticalAlign: "-1.5px", marginRight: 6, color: "var(--brand-primary)" }}>
                {cloneElement(Icons.check, { size: 11, sw: 2.5 } as never)}
              </span>
            )}
            {src && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--fg-3)",
                  letterSpacing: ".04em",
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "rgba(60,40,25,0.05)",
                  marginRight: 6,
                }}
              >
                {src}
              </span>
            )}
            {preview}
          </span>
          {badge != null && (
            <span
              style={{
                flexShrink: 0,
                minWidth: 20,
                height: 20,
                padding: "0 7px",
                borderRadius: 999,
                background: "var(--brand-primary)",
                color: "var(--fg-on-brand)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {badge}
            </span>
          )}
          {star && <Glyph ch="★" size={15} color="var(--brand-primary)" />}
          {pulsing && <Pulse size={7} />}
          {onMore && (
            <button
              aria-label="действия"
              onClick={(e) => {
                e.stopPropagation();
                onMore();
              }}
              style={{
                flexShrink: 0,
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "transparent",
                border: "none",
                color: "var(--fg-4)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {cloneElement(ExtraIcons.more, { size: 16, sw: 1.6 } as never)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function DaySeparator({ label }: { label: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 10px" }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--fg-3)",
          letterSpacing: ".12em",
          fontWeight: 500,
          padding: "4px 12px",
          background: "rgba(234,227,207,0.7)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderRadius: 999,
        }}
      >
        {label}
      </span>
    </div>
  );
}
