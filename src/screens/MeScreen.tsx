/* ЭКРАН 4 — Я. Дизайн: ui_kits/mini_app Screens.jsx → MeScreen.
   Профиль/статы из /users/me. Бэкенда настроек пока нет (только GET /users/me),
   поэтому ВСЕ пункты настроек — «в разработке» (тост по тапу, без рабочих тоглов:
   тогл создавал ложное ощущение работающей настройки). */
import { useState, useEffect, cloneElement, type ReactElement } from "react";
import { Icons } from "../components/ds/icons";
import { api, type UserInfo } from "../lib/api";
import { formatDate } from "../lib/formatters";

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
      {rows.map((it, i) => (
        <button
          key={it.label}
          type="button"
          onClick={it.onClick}
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
            cursor: "pointer",
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
          {/* всё в разработке — единый бейдж вместо тоглов/чевронов */}
          <span
            style={{
              fontFamily: "var(--font-ui)",
              fontSize: 11,
              fontWeight: 500,
              color: "var(--fg-4)",
              background: "var(--fill-2, rgba(60,40,25,0.05))",
              padding: "2px 8px",
              borderRadius: 999,
              flexShrink: 0,
              letterSpacing: "-0.005em",
            }}
          >
            Скоро
          </span>
        </button>
      ))}
    </div>
  );
}

export function MeScreen({ onComingSoon }: { onComingSoon: () => void }) {
  const [me, setMe] = useState<UserInfo | null>(null);

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
    <div style={{ padding: "12px 16px calc(74px + env(safe-area-inset-bottom, 0px))" }}>
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
            {me ? `${me.bookmarks_count} закладок · ${since}` : "Загрузка…"}
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
          { icon: Icons.brain, label: "Тихий режим", onClick: onComingSoon },
          { icon: Icons.brain, label: "AI-подсказки", onClick: onComingSoon },
          { icon: Icons.brain, label: "Таймзона", onClick: onComingSoon },
        ]}
      />

      <SettingsTitle>Вид</SettingsTitle>
      <SettingsCard
        rows={[
          { icon: Icons.feed, label: "Тема", onClick: onComingSoon },
          { icon: Icons.archive, label: "Архивировать через", onClick: onComingSoon },
          { icon: Icons.cards, label: "Плотный список", onClick: onComingSoon },
        ]}
      />

      <SettingsTitle>Данные</SettingsTitle>
      <SettingsCard
        rows={[
          { icon: Icons.link, label: "Экспорт в markdown", onClick: onComingSoon },
          { icon: Icons.link, label: "Подключить Notion", onClick: onComingSoon },
          { icon: Icons.tag, label: "Авто-теги", onClick: onComingSoon },
        ]}
      />

      <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 12.5, color: "var(--fg-3)", textAlign: "center", letterSpacing: 0, marginTop: 22 }}>
        v0.5 · собрано вручную
      </div>
    </div>
  );
}
