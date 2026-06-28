/* useVoiceRecorder — машина состояний голосовой записи (idle → recording → sending).
   Вынесена из ComposeScreen, чтобы переиспользовать в ленте заметки (F3d) без
   дублирования fiddly-логики жизненного цикла микрофона (iOS-нюансы, double-tap
   guard, освобождение трека при размонтировании). UI (полноэкранный оверлей vs
   компактная строка) остаётся за компонентом — хук про него не знает.
   Источник правды для записи — recorder.ts (MediaRecorder). */
import { useEffect, useRef, useState } from "react";
import {
  VoiceRecorder,
  isSupported as voiceSupported,
  filenameForMime,
  isTooShort,
  isTooLarge,
} from "../../lib/recorder";

export type VoiceState = "idle" | "recording" | "sending";

/** Готовая запись для загрузки (blob + длительность + имя по MIME для бэка). */
export interface VoicePayload {
  blob: Blob;
  duration: number;
  filename: string;
}

interface UseVoiceRecorderArgs {
  /** Запись включена флагом (само наличие MediaRecorder хук проверит сам). */
  enabled: boolean;
  /** Что делать с готовой записью (загрузить). Бросок → тост ошибки + возврат в idle. */
  onResult: (payload: VoicePayload) => Promise<void>;
  onToast?: (msg: string) => void;
  /** Запись недоступна в окружении (старый iOS WebView) — фолбэк родителя (напр. чат
   *  бота). Вернуть true, если фолбэк сработал (тогда тост «доступна в чате» не показываем). */
  onUnsupported?: () => boolean;
  /** Остаться в sending после успеха (родитель размонтирует экран — иначе мигнёт idle
   *  на кадр перед unmount). По умолчанию false → возврат в idle. */
  keepSendingOnSuccess?: boolean;
}

export function useVoiceRecorder({
  enabled,
  onResult,
  onToast,
  onUnsupported,
  keepSendingOnSuccess = false,
}: UseVoiceRecorderArgs) {
  // canRecord = флаг включён И окружение умеет писать. Кнопку 🎤 показываем по `enabled`
  // (тап при !canRecord уводит в фолбэк), а реально стартуем только при canRecord.
  const canRecord = enabled && voiceSupported();
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const aliveRef = useRef(true);

  // Уход с экрана во время записи → освобождаем микрофон (иначе индикатор висит,
  // на iOS блокируется повторная запись).
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

  const startRecording = async () => {
    // Запись уже стартует/идёт — иначе дабл-тап плодит второй recorder и течёт mic-трек.
    if (recorderRef.current) return;
    if (!canRecord) {
      // Окружение без записи (старый iOS) → фолбэк родителя, иначе тост.
      if (enabled && !(onUnsupported?.() ?? false)) onToast?.("Запись голоса доступна в чате с ботом");
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

  // Отмена — освободить микрофон и вернуться к набору (остаёмся на экране).
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
      await onResult({ blob, duration: durationSec, filename: filenameForMime(mimeType) });
      if (!keepSendingOnSuccess && aliveRef.current) setVoiceState("idle");
    } catch (e) {
      onToast?.(e instanceof Error ? e.message : "Не удалось отправить голос");
      if (aliveRef.current) setVoiceState("idle");
    }
  };

  return { canRecord, voiceState, elapsed, startRecording, cancelRecording, stopAndSend };
}
