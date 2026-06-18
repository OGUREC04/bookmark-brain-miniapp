/* ComposeScreen — полноэкранная «Новая мысль» (заменяет QuickCreateSheet).
   Захват: текст + голос. Композер расширяется (компакт одной строкой → при
   длинном тексте кнопки уходят вниз, текст сверху — паттерн Meta/Gemini).
   Микрофон + плюс слева, отправка справа. Тап по 🎤 разворачивает экран в
   иммерсивную запись (крупный таймер + псевдо-волна + Отмена/Отправить).
   Микрофон освобождается при стопе И при уходе с экрана (abort в cleanup). */
import { useState, useRef, useEffect, cloneElement } from "react";
import { Icons, ExtraIcons } from "../components/ds/icons";
import { FLAGS } from "../lib/flags";
import {
  VoiceRecorder,
  isSupported as voiceSupported,
  filenameForMime,
  isTooShort,
  isTooLarge,
} from "../lib/recorder";
import { canSend, shouldExpandComposer } from "../lib/compose";
import { openBotVoiceChat } from "../lib/telegram";
import type { Bookmark } from "../lib/api";

type VoiceState = "idle" | "recording" | "sending";

const MAX_TEXTAREA_PX = 168;
// Статичные высоты бар-ов псевдо-волны (анимация — через .bb-wave-bar).
const WAVE_BARS = [16, 26, 36, 20, 42, 28, 16, 34, 44, 22, 30, 38, 18, 28, 14, 36, 24, 16];

function fmtElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec % 60).padStart(2, "0")}`;
}

export function ComposeScreen({
  onClose,
  onSave,
  onToast,
  onUploadMedia,
  onCreated,
}: {
  /** Закрыть экран (снять слой compose со стека). */
  onClose: () => void;
  onSave?: (text: string) => void | Promise<void>;
  onToast?: (msg: string) => void;
  /** FLAGS.VOICE_UPLOAD: загрузка голоса. undefined = голос выключен. */
  onUploadMedia?: (file: Blob, opts: { kind: "audio"; duration: number; filename: string }) => Promise<Bookmark>;
  /** Голос создал заметку — родитель закроет экран и откроет её. */
  onCreated?: (bm: Bookmark) => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const sendEnabled = canSend(text, saving);
  const expanded = shouldExpandComposer(text);

  const voiceOn = FLAGS.VOICE_UPLOAD && !!onUploadMedia;
  const canRecord = voiceOn && voiceSupported();
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const aliveRef = useRef(true);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  // Уход с экрана во время записи → освобождаем микрофон.
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      recorderRef.current?.abort();
      recorderRef.current = null;
    };
  }, []);

  // Таймер записи (mm:ss).
  useEffect(() => {
    if (voiceState !== "recording") return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [voiceState]);

  // Авто-рост textarea под текст (до предела), без фикс. rows.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
  }, [text]);

  const save = async () => {
    if (!sendEnabled) return;
    setSaving(true);
    try {
      await onSave?.(text.trim());
    } finally {
      if (aliveRef.current) setSaving(false);
    }
  };

  const startRecording = async () => {
    if (!canRecord) {
      // Старый iOS WebView без записи → фолбэк в чат бота, иначе тост.
      if (voiceOn && !openBotVoiceChat()) onToast?.("Запись голоса доступна в чате с ботом");
      return;
    }
    const rec = new VoiceRecorder();
    recorderRef.current = rec;
    try {
      await rec.start();
      if (!aliveRef.current) {
        rec.abort();
        return;
      }
      setElapsed(0);
      setVoiceState("recording");
    } catch {
      recorderRef.current = null;
      onToast?.("Нет доступа к микрофону");
    }
  };

  // Отмена записи — освободить микрофон и вернуться к набору (остаёмся на экране).
  const cancelRecording = () => {
    recorderRef.current?.abort();
    recorderRef.current = null;
    if (aliveRef.current) {
      setVoiceState("idle");
      setElapsed(0);
    }
  };

  const stopAndSend = async () => {
    const rec = recorderRef.current;
    if (!rec) return;
    setVoiceState("sending");
    let result;
    try {
      result = await rec.stop();
    } catch {
      recorderRef.current = null;
      if (aliveRef.current) setVoiceState("idle");
      return;
    }
    recorderRef.current = null;
    const { blob, mimeType, durationSec } = result;
    if (isTooShort(blob, durationSec)) {
      onToast?.("Слишком короткая запись");
      if (aliveRef.current) setVoiceState("idle");
      return;
    }
    if (isTooLarge(blob)) {
      onToast?.("Запись слишком большая (максимум 25 МБ)");
      if (aliveRef.current) setVoiceState("idle");
      return;
    }
    try {
      const bm = await onUploadMedia!(blob, {
        kind: "audio",
        duration: durationSec,
        filename: filenameForMime(mimeType),
      });
      onCreated?.(bm); // родитель закроет экран и откроет заметку
    } catch (e) {
      onToast?.(e instanceof Error ? e.message : "Не удалось отправить голос");
      if (aliveRef.current) setVoiceState("idle");
    }
  };

  const recording = voiceState === "recording";
  const sending = voiceState === "sending";

  // Глиф-кнопка по DS: скруглённый квадрат (не круг).
  const glyphBtn = {
    width: 36,
    height: 36,
    borderRadius: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  } as const;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--backdrop-gradient, var(--bg-page))",
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      {recording || sending ? (
        /* ─── Иммерсивная запись ─────────────────────────────────── */
        <>
          <div style={{ height: 56 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px", textAlign: "center" }}>
            {!sending && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--semantic-error, #B5483A)", display: "inline-block", animation: "mPulse 1.6s ease-in-out infinite" }} />
                <span style={{ fontFamily: "var(--font-ui)", fontSize: 13, color: "var(--fg-3)" }}>Идёт запись</span>
              </div>
            )}
            <div style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 42, color: sending ? "var(--fg-4)" : "var(--fg-1)", letterSpacing: "0.01em" }}>
              {fmtElapsed(elapsed)}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, height: 48, marginTop: 22, opacity: sending ? 0.3 : 1 }}>
              {WAVE_BARS.map((h, i) => (
                <span
                  key={i}
                  className={sending ? undefined : "bb-wave-bar"}
                  style={{ display: "inline-block", width: 3, borderRadius: 2, background: "var(--brand-primary)", height: h, animationDelay: `${(i % 8) * 0.08}s` }}
                />
              ))}
            </div>
            {sending && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 30 }}>
                <span style={{ width: 18, height: 18, border: "2px solid var(--border-2)", borderTopColor: "var(--brand-primary)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <span style={{ fontFamily: "var(--font-ui)", fontSize: 16, color: "var(--fg-2)" }}>Отправляю…</span>
              </div>
            )}
          </div>
          {!sending && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, padding: "0 24px 18px" }}>
              {/* Отмена — кружок с корзиной, без обводки. */}
              <button
                type="button"
                aria-label="отмена записи"
                onClick={cancelRecording}
                style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--surface-glass-subtle, rgba(255,252,246,0.5))", border: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-3)", cursor: "pointer", flexShrink: 0 }}
              >
                {cloneElement(ExtraIcons.trash, { size: 21, sw: 1.6 } as never)}
              </button>
              {/* Отправить — пилюля с текстом (главное действие доминирует). */}
              <button
                type="button"
                aria-label="остановить и отправить"
                onClick={stopAndSend}
                style={{ height: 48, borderRadius: 24, padding: "0 22px", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "var(--brand-primary)", border: "none", color: "var(--fg-on-brand)", fontFamily: "var(--font-ui)", fontSize: 15, fontWeight: 500, letterSpacing: "-0.005em", cursor: "pointer", boxShadow: "var(--shadow-fab)" }}
              >
                {cloneElement(ExtraIcons.send, { size: 19, sw: 1.7 } as never)}
                Отправить
              </button>
            </div>
          )}
        </>
      ) : (
        /* ─── Покой: герой + расширяющийся композер ───────────────── */
        <>
          <div style={{ display: "flex", alignItems: "center", padding: "12px 12px 0" }}>
            <button
              type="button"
              aria-label="назад"
              onClick={onClose}
              style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: "var(--brand-primary)", cursor: "pointer", padding: 0 }}
            >
              {cloneElement(Icons.chevronLeft, { size: 24, sw: 2.2 } as never)}
            </button>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 28px", textAlign: "center" }}>
            <span style={{ color: "var(--brand-primary)", marginBottom: 14, display: "flex" }}>
              {cloneElement(ExtraIcons.sparkle, { size: 26, sw: 1.6 } as never)}
            </span>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 25, lineHeight: 1.25, color: "var(--fg-1)", letterSpacing: "-0.01em" }}>
              Что у тебя на уме?
            </div>
            <div style={{ fontFamily: "var(--font-display)", fontStyle: "italic", fontSize: 14, color: "var(--fg-3)", marginTop: 10, lineHeight: 1.45 }}>
              Кинь мысль, ссылку или надиктуй — Brain разберёт сам
            </div>
          </div>

          <div style={{ padding: "0 14px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                gridTemplateAreas: expanded
                  ? '"input input input" "lead mid send"'
                  : '"lead input send"',
                alignItems: "center",
                gap: 8,
                background: "var(--bg-surface)",
                border: "1px solid var(--border-1)",
                borderRadius: 22,
                padding: 8,
                boxShadow: "var(--shadow-2)",
              }}
            >
              {/* Слева: вложение (📎, фаза 2 — disabled) + голос (🎤). */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, gridArea: "lead" }}>
                <button
                  type="button"
                  aria-label="вложение"
                  disabled
                  style={{ ...glyphBtn, background: "transparent", border: "none", color: "var(--fg-4)", cursor: "not-allowed" }}
                >
                  {cloneElement(Icons.plus, { size: 20, sw: 2 } as never)}
                </button>
                {voiceOn && (
                  <button
                    type="button"
                    aria-label="записать голос"
                    onClick={() => void startRecording()}
                    style={{ ...glyphBtn, background: "var(--brand-primary-tint)", border: "none", color: "var(--brand-primary-press)", cursor: "pointer" }}
                  >
                    {cloneElement(ExtraIcons.mic, { size: 20, sw: 1.6 } as never)}
                  </button>
                )}
              </div>

              <textarea
                ref={taRef}
                className="compose-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Мысль или ссылка…"
                autoFocus
                rows={1}
                style={{
                  gridArea: "input",
                  width: "100%",
                  minWidth: 0,
                  boxSizing: "border-box",
                  maxHeight: MAX_TEXTAREA_PX,
                  overflowY: "auto",
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
                onClick={save}
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
          </div>
        </>
      )}
    </div>
  );
}
