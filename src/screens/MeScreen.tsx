/* ЭКРАН 4 — Я. Дизайн: ui_kits/mini_app Screens.jsx → MeScreen.
   Профиль/статы из /users/me. Тогглы — локальные (бэкенд-настроек пока нет:
   только GET /users/me), чевроны → тост «в разработке». */
import { useState, useEffect, cloneElement, type ReactElement } from "react";
import { Icons } from "../components/ds/icons";
import { api, type UserInfo } from "../lib/api";
import { formatDate } from "../lib/formatters";

function Toggle({ on }: { on: boolean }) {
  return (
    <span
      style={{
        width: 36,
        height: 22,
        borderRadius: 999,
        background: on ? "var(--brand-primary)" : "rgba(180,170,160,0.45)",
        position: "relative",
        transition: "background 200ms var(--ease-out)",
        boxShadow: on ? "inset 0 1px 2px rgba(0,0,0,0.1)" : "inset 0 1px 2px rgba(0,0,0,0.06)",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: on ? 16 : 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 200ms var(--ease-out)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}
      />
    </span>
  );
}

function StatCard({ n, label, delta }: { n: string | number; label: string; delta?: string }) {
  return (
    <div
      style={{
        padding: "14px 12px",
        textAlign: "center",
        background: "var(--surface-glass)",
        backdropFilter: "var(--blur-card)",
        WebkitBackdropFilter: "var(--blur-card)",
        border: "var(--glass-border)",
        borderRadius: "var(--radius-stat)",
        boxShadow: "var(--shadow-glass-card)",
      }}
    >
      <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 500, fontSize: 28, color: "var(--brand-primary)", lineHeight: 1, letterSpacing: "-0.01em" }}>
        {n}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: ".08em", marginTop: 6, fontWeight: 500 }}>
        {label}
      </div>
      {delta && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: delta.startsWith("+") ? "var(--semantic-success, #5A8A56)" : "var(--fg-3)", letterSpacing: ".06em", marginTop: 4 }}>
          {delta}
        </div>
      )}
    </div>
  );
}

interface SettingRow {
  icon: ReactElement;
  label: string;
  value?: string;
  toggle?: boolean;
  chevron?: boolean;
  onToggle?: () => void;
  onClick?: () => void;
}

function SettingsTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 13, color: "var(--fg-3)", margin: "4px 4px 6px", letterSpacing: 0 }}>
      {children}
    </div>
  );
}

function SettingsCard({ rows }: { rows: SettingRow[] }) {
  return (
    <div
      style={{
        background: "var(--surface-glass)",
        backdropFilter: "var(--blur-card)",
        WebkitBackdropFilter: "var(--blur-card)",
        border: "var(--glass-border)",
        borderRadius: "var(--radius-input)",
        overflow: "hidden",
        marginBottom: 16,
        boxShadow: "var(--glass-inner-light), var(--shadow-glass-sm)",
      }}
    >
      {rows.map((it, i) => {
        const interactive = it.onClick || it.onToggle;
        return (
          <button
            key={it.label}
            onClick={it.onToggle ?? it.onClick}
            aria-pressed={it.toggle != null ? it.toggle : undefined}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "13px 16px",
              background: "transparent",
              border: "none",
              textAlign: "left",
              borderBottom: i < rows.length - 1 ? "1px solid var(--border-1)" : "none",
              fontSize: 14.5,
              letterSpacing: "-0.01em",
              color: "var(--fg-1)",
              fontFamily: "var(--font-ui)",
              cursor: interactive ? "pointer" : "default",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <span style={{ color: "var(--fg-3)", display: "flex", flexShrink: 0 }}>
              {cloneElement(it.icon, { size: 18, sw: 1.6 } as never)}
            </span>
            <span style={{ flex: 1 }}>{it.label}</span>
            {it.value && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", letterSpacing: ".04em" }}>{it.value}</span>
            )}
            {it.toggle != null && <Toggle on={it.toggle} />}
            {it.chevron && (
              <span style={{ color: "var(--fg-4)", display: "flex" }}>{cloneElement(Icons.arrow, { size: 14, sw: 1.6 } as never)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function MeScreen({ onComingSoon }: { onComingSoon: () => void }) {
  const [me, setMe] = useState<UserInfo | null>(null);
  // Локальные тогглы (персистентного бэкенда настроек пока нет).
  const [quietMode, setQuietMode] = useState(false);
  const [aiSuggest, setAiSuggest] = useState(true);
  const [autoTags, setAutoTags] = useState(true);
  const [denseList, setDenseList] = useState(false);

  useEffect(() => {
    let alive = true;
    api.getMe().then((u) => alive && setMe(u)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const handle = me?.telegram_username ? `@${me.telegram_username}` : me?.telegram_first_name || "@anonim";
  const initial = (handle.replace("@", "")[0] || "а").toLowerCase();
  const since = me ? `с ${formatDate(me.created_at)}` : "";

  return (
    <div style={{ padding: "6px 16px calc(116px + env(safe-area-inset-bottom, 0px))" }}>
      <h1 style={{ fontSize: 32, fontWeight: 500, letterSpacing: "-0.035em", margin: "4px 0 16px", color: "var(--fg-1)", lineHeight: 1 }}>
        я
        <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 500, color: "var(--brand-primary)", marginLeft: 6, letterSpacing: "-0.01em" }}>·</span>
      </h1>

      {/* profile card */}
      <div
        style={{
          background: "var(--surface-glass-strong)",
          backdropFilter: "var(--blur-card)",
          WebkitBackdropFilter: "var(--blur-card)",
          border: "var(--glass-border)",
          borderRadius: "var(--radius-tile)",
          padding: 16,
          display: "flex",
          gap: 14,
          alignItems: "center",
          marginBottom: 10,
          boxShadow: "var(--shadow-glass-card)",
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #8FA888 0%, #4A6648 100%)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.4), 0 2px 6px rgba(60,40,25,0.06)",
            flexShrink: 0,
          }}
        >
          <span style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontWeight: 500, fontSize: 30, letterSpacing: "-0.01em" }}>{initial}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 500, letterSpacing: "-0.02em", color: "var(--fg-1)" }}>{handle}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", letterSpacing: ".04em", marginTop: 2 }}>
            {me ? `${me.bookmarks_count} закладок · ${since}` : "загрузка…"}
          </div>
        </div>
      </div>

      {/* stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
        <StatCard n={me?.bookmarks_count ?? "—"} label="Всего" />
        <StatCard n="—" label="На неделе" />
        <StatCard n="—" label="Прочитал" />
      </div>

      <SettingsTitle>Приватность</SettingsTitle>
      <SettingsCard
        rows={[
          { icon: Icons.brain, label: "Тихий режим", toggle: quietMode, onToggle: () => setQuietMode((v) => !v) },
          { icon: Icons.brain, label: "AI-подсказки", toggle: aiSuggest, onToggle: () => setAiSuggest((v) => !v) },
          { icon: Icons.brain, label: "Таймзона", value: "GMT+3", chevron: true, onClick: onComingSoon },
        ]}
      />

      <SettingsTitle>Вид</SettingsTitle>
      <SettingsCard
        rows={[
          { icon: Icons.feed, label: "Тема", value: "Echo · light", chevron: true, onClick: onComingSoon },
          { icon: Icons.archive, label: "Архивировать через", value: "90 дней", chevron: true, onClick: onComingSoon },
          { icon: Icons.cards, label: "Плотный список", toggle: denseList, onToggle: () => setDenseList((v) => !v) },
        ]}
      />

      <SettingsTitle>Данные</SettingsTitle>
      <SettingsCard
        rows={[
          { icon: Icons.link, label: "Экспорт в markdown", chevron: true, onClick: onComingSoon },
          { icon: Icons.link, label: "Подключить Notion", chevron: true, onClick: onComingSoon },
          { icon: Icons.tag, label: "Авто-теги", toggle: autoTags, onToggle: () => setAutoTags((v) => !v) },
        ]}
      />

      <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 12.5, color: "var(--fg-3)", textAlign: "center", letterSpacing: 0, marginTop: 22 }}>
        v0.5 · собрано вручную
      </div>
    </div>
  );
}
