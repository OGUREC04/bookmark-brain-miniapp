/* ThreadComposer — закреплённая снизу строка дописки в ленте заметки
   (заметка-как-диалог, F3b текст + F3d голос). Текст через переиспользуемый
   Composer, голос (🎤) в lead-слоте. При записи компактная строка-рекордер
   заменяет поле (паттерн Telegram/WhatsApp: тап 🎤 → строка записи вместо ввода,
   а не полноэкранный оверлей как в ComposeScreen). Голос → api.entries.upload →
   запись entry_ai_status='transcribing'; поллинг статуса — в DetailScreen (DEC-11). */
import { cloneElement, useEffect, useRef, useState } from "react";
import { Composer } from "./Composer";
import { Pulse, GLYPH_BTN_STYLE } from "./atoms";
import { ExtraIcons } from "./icons";
import { useVoiceRecorder } from "./useVoiceRecorder";
import { api, type Entry } from "../../lib/api";
import { FLAGS } from "../../lib/flags";
import { fmtElapsed } from "../../lib/formatters";

// Статичные высоты бар-ов псевдо-волны (анимация — .bb-wave-bar). Короче, чем в
// ComposeScreen: компактная строка, не полноэкранная запись.
const WAVE_BARS = [12, 20, 28, 16, 32, 22, 14, 26, 18, 24];

export function ThreadComposer({
  bookmarkId,
  onPosted,
  onToast,
}: {
  bookmarkId: string;
  /** Новая дописка создана (текст или голос-черновик 'transcribing') → добавить в ленту. */
  onPosted: (entry: Entry) => void;
  onToast?: (msg: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  // Гард setState/onPosted после await — если экран ушёл со стека до ответа сети
  // (конвенция: ComposeScreen/DetailScreen гардят async-колбэки так же).
  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const voiceOn = FLAGS.VOICE_UPLOAD;
  const { voiceState, elapsed, startRecording, cancelRecording, stopAndSend } = useVoiceRecorder({
    enabled: voiceOn,
    onToast,
    onResult: async ({ blob, duration, filename }) => {
      // Голос-дописка: запись возвращается со статусом 'transcribing'; распознавание
      // дальше подтянет thread-поллинг в DetailScreen.
      const entry = await api.entries.upload(bookmarkId, blob, { duration, filename });
      if (aliveRef.current) onPosted(entry);
    },
  });

  const appendText = async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    try {
      const entry = await api.entries.create(bookmarkId, body);
      if (aliveRef.current) {
        onPosted(entry);
        setDraft("");
      }
    } catch {
      if (aliveRef.current) onToast?.("Не удалось добавить запись");
    } finally {
      if (aliveRef.current) setPosting(false);
    }
  };

  const recording = voiceState === "recording";
  const sending = voiceState === "sending";

  return (
    <div
      style={{
        // position:fixed — над safe-area; контент DetailScreen имеет нижний отступ под бар.
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        padding: "8px 12px calc(8px + env(safe-area-inset-bottom, 0px))",
        background: "var(--bg-page)",
        borderTop: "0.5px solid var(--border-1)",
        zIndex: 5,
      }}
    >
      {recording || sending ? (
        /* ─── Компактная строка записи: 🗑 · таймер+волна · ➤ ─── */
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "var(--bg-surface)",
            border: "1px solid var(--border-1)",
            borderRadius: 22,
            padding: 8,
            boxShadow: "var(--shadow-2)",
          }}
        >
          <button
            type="button"
            aria-label="отмена записи"
            onClick={cancelRecording}
            disabled={sending}
            style={{ ...GLYPH_BTN_STYLE, background: "transparent", border: "none", color: "var(--fg-3)", cursor: sending ? "default" : "pointer", opacity: sending ? 0.4 : 1 }}
          >
            {cloneElement(ExtraIcons.trash, { size: 19, sw: 1.6 } as never)}
          </button>

          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <Pulse size={8} color={sending ? "var(--fg-4)" : "var(--semantic-error, #B5483A)"} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--fg-2)", letterSpacing: "0.01em" }}>
              {fmtElapsed(elapsed)}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 2, height: 20, opacity: sending ? 0.3 : 1, overflow: "hidden" }}>
              {WAVE_BARS.map((h, i) => (
                <span
                  key={i}
                  className={sending ? undefined : "bb-wave-bar"}
                  style={{ display: "inline-block", width: 2.5, borderRadius: 2, background: "var(--brand-primary)", height: h, animationDelay: `${(i % 8) * 0.08}s` }}
                />
              ))}
            </div>
            {sending && (
              <span style={{ marginLeft: "auto", fontFamily: "var(--font-ui)", fontSize: 12.5, color: "var(--fg-3)", whiteSpace: "nowrap" }}>
                Отправляю…
              </span>
            )}
          </div>

          <button
            type="button"
            aria-label="остановить и отправить"
            onClick={() => void stopAndSend()}
            disabled={sending}
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--brand-primary)",
              border: "none",
              color: "var(--fg-on-brand)",
              opacity: sending ? 0.5 : 1,
              boxShadow: "var(--shadow-fab)",
              cursor: sending ? "default" : "pointer",
              flexShrink: 0,
            }}
          >
            {cloneElement(ExtraIcons.send, { size: 20, sw: 1.7 } as never)}
          </button>
        </div>
      ) : (
        /* ─── Покой: текст-композер с 🎤 в lead-слоте ─── */
        <Composer
          value={draft}
          onChange={setDraft}
          onSend={appendText}
          sending={posting}
          placeholder="Дописать в заметку…"
          lead={
            voiceOn ? (
              <button
                type="button"
                aria-label="записать голос"
                onClick={() => void startRecording()}
                style={{ ...GLYPH_BTN_STYLE, background: "var(--brand-primary-tint)", border: "none", color: "var(--brand-primary-press)", cursor: "pointer" }}
              >
                {cloneElement(ExtraIcons.mic, { size: 20, sw: 1.6 } as never)}
              </button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
