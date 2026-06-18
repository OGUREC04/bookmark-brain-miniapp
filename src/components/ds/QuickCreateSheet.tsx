/* QuickCreateSheet — FAB+ (functional): текст + голосовая запись (тикет ti0, фаза 1).
   Голос за FLAGS.VOICE_UPLOAD: 🎤 → запись (MediaRecorder) → upload → родитель открывает заметку.
   Микрофон освобождается при стопе И при закрытии листа во время записи (abort в cleanup). */
import { useState, useRef, useEffect, cloneElement } from "react";
import { ExtraIcons } from "./icons";
import { BottomSheet, SheetTitle, TelegramMainButton } from "./sheetPrimitives";
import { FLAGS } from "../../lib/flags";
import {
  VoiceRecorder,
  isSupported as voiceSupported,
  filenameForMime,
  isTooShort,
  isTooLarge,
} from "../../lib/recorder";
import { openBotVoiceChat } from "../../lib/telegram";
import type { Bookmark } from "../../lib/api";

type VoiceState = "idle" | "recording" | "sending";

function fmtElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${m}:${String(sec % 60).padStart(2, "0")}`;
}

export function QuickCreateSheet({
  onDismiss,
  onSave,
  onToast,
  onUploadMedia,
  onCreated,
}: {
  onDismiss?: () => void;
  onSave?: (text: string) => void | Promise<void>;
  onToast?: (msg: string) => void;
  /** FLAGS.VOICE_UPLOAD: загрузка голоса на бэк. undefined = голос выключен. */
  onUploadMedia?: (file: Blob, opts: { kind: "audio"; duration: number; filename: string }) => Promise<Bookmark>;
  /** Голос создал заметку — родитель открывает её (покажет «Brain слушает…»). */
  onCreated?: (bm: Bookmark) => void;
}) {
  const [v, setV] = useState("");
  const [saving, setSaving] = useState(false);
  const enabled = v.trim().length > 0 && !saving;

  // Голос (ti0): доступен только при флаге, наличии обработчика и поддержке записи в окружении.
  const voiceOn = FLAGS.VOICE_UPLOAD && !!onUploadMedia;
  const canRecord = voiceOn && voiceSupported();
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const aliveRef = useRef(true);

  // Закрытие листа во время записи → освобождаем микрофон (иначе индикатор висит / iOS блокирует).
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

  const save = async () => {
    if (!enabled) return;
    setSaving(true);
    try {
      await onSave?.(v.trim());
    } finally {
      if (aliveRef.current) setSaving(false);
    }
  };

  const startRecording = async () => {
    if (!canRecord) {
      // Запись недоступна (старый iOS WebView) → фолбэк в чат бота, иначе тост.
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

  const stopRecording = async () => {
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
      onCreated?.(bm); // родитель закроет лист и откроет заметку
    } catch (e) {
      onToast?.(e instanceof Error ? e.message : "Не удалось отправить голос");
      if (aliveRef.current) setVoiceState("idle");
    }
  };

  const micClick = () => {
    if (voiceState === "recording") void stopRecording();
    else if (voiceState === "idle") void startRecording();
  };

  const recording = voiceState === "recording";
  const sending = voiceState === "sending";

  return (
    <BottomSheet onDismiss={onDismiss}>
      <SheetTitle title="Новая мысль" right="Бот разберёт сам" onClose={onDismiss} />

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
              Пиши мысль · вставь ссылку · бот разберёт сам
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
          {/* Документы (📎) — фаза 2, пока disabled. */}
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

          {/* Голос (🎤) — запись / стоп. */}
          <button
            aria-label={recording ? "остановить запись" : "записать голос"}
            onClick={micClick}
            disabled={!voiceOn || sending}
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              background: recording
                ? "var(--brand-primary)"
                : voiceOn
                  ? "rgba(122,156,122,0.12)"
                  : "rgba(234,227,207,0.4)",
              border: recording ? "1px solid var(--brand-primary)" : "1px solid var(--border-1)",
              color: recording ? "var(--fg-on-brand)" : voiceOn ? "var(--brand-primary)" : "var(--fg-4)",
              cursor: voiceOn && !sending ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 160ms var(--ease-out), color 160ms var(--ease-out)",
            }}
          >
            {cloneElement(ExtraIcons.mic, { size: 16, sw: 1.6 } as never)}
          </button>

          <span
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: recording || sending ? "var(--font-ui)" : "var(--font-display)",
              fontStyle: recording || sending ? "normal" : "italic",
              fontSize: 12,
              color: recording ? "var(--brand-primary)" : "var(--fg-3)",
              letterSpacing: recording || sending ? "-0.005em" : 0,
            }}
          >
            {recording ? (
              <>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "var(--brand-primary)",
                    animation: "mPulse 1.6s ease-in-out infinite",
                    flexShrink: 0,
                  }}
                />
                Идёт запись · {fmtElapsed(elapsed)}
              </>
            ) : sending ? (
              "Отправляю…"
            ) : voiceOn ? (
              "Запиши голос или прикрепи в боте"
            ) : (
              "Вложения — в боте"
            )}
          </span>
        </div>

        <div style={{ marginTop: 8 }}>
          <TelegramMainButton label={saving ? "Сохраняю…" : "Сохранить"} enabled={enabled} onClick={save} />
        </div>
      </div>
    </BottomSheet>
  );
}
