/* Голосовая запись через нативный MediaRecorder (тикет ti0, фаза 1 — только голос).
   Без внешних зависимостей. Бэк сам транскодит (ffmpeg) → шлём любой формат, что даст браузер.
   Время инъектируется (getNow) ради детерминированных тестов длительности. */

// Лимит аудио на бэке (config.py UPLOAD_MAX_AUDIO_MB=25). Дублируем, чтобы рубить ДО отправки.
const AUDIO_MAX_BYTES = 25 * 1024 * 1024;
const MIN_DURATION_SEC = 0.5;

// Приоритет MIME: webm/opus (Chrome/Android) → mp4 (iOS Safari) → ogg. Бэк маршрутизирует по суффиксу.
const MIME_PRIORITY = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;

// Динамическое чтение глобала — чтобы пережить окружения без MediaRecorder (старый iOS WebView).
function getMediaRecorderCtor(): { isTypeSupported?: (mime: string) => boolean } | undefined {
  return (globalThis as { MediaRecorder?: { isTypeSupported?: (mime: string) => boolean } }).MediaRecorder;
}

/** Лучший поддерживаемый MIME, или "" если запись в этом окружении недоступна. */
export function pickMimeType(): string {
  const MR = getMediaRecorderCtor();
  if (!MR || typeof MR.isTypeSupported !== "function") return "";
  for (const mime of MIME_PRIORITY) {
    if (MR.isTypeSupported(mime)) return mime;
  }
  return "";
}

/** Имя файла по MIME. Бэк определяет формат и транскод по СУФФИКСУ — имя обязательно (load-bearing). */
export function filenameForMime(mime: string): string {
  if (mime.includes("mp4")) return "voice.mp4";
  if (mime.includes("ogg")) return "voice.ogg";
  return "voice.webm"; // webm + дефолт для пустого/неизвестного MIME
}

/** Доступна ли запись (MediaRecorder + getUserMedia + хоть один MIME). Иначе — iOS-фолбэк в боте. */
export function isSupported(): boolean {
  if (!getMediaRecorderCtor()) return false;
  const md = (globalThis.navigator as Navigator | undefined)?.mediaDevices;
  if (!md || typeof md.getUserMedia !== "function") return false;
  return pickMimeType() !== "";
}

/** Пустая/слишком короткая запись — не отправляем (бэк вернёт 400, незачем гонять). */
export function isTooShort(blob: Blob, durationSec: number): boolean {
  return blob.size === 0 || durationSec < MIN_DURATION_SEC;
}

/** Превышен лимит аудио (25 МБ) — не отправляем (бэк вернёт 413). */
export function isTooLarge(blob: Blob): boolean {
  return blob.size > AUDIO_MAX_BYTES;
}

export interface RecordingResult {
  blob: Blob;
  mimeType: string;
  durationSec: number;
}

interface VoiceRecorderOpts {
  /** Источник времени (для тестов). По умолчанию Date.now. */
  getNow?: () => number;
}

/** Одна сессия записи: start() → stop()/abort(). И stop, и abort ОСВОБОЖДАЮТ микрофон
    (stream tracks .stop()), иначе индикатор записи висит, а на iOS блокируется повторная запись. */
export class VoiceRecorder {
  private readonly getNow: () => number;
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mimeType = "";
  private startTs = 0;

  constructor(opts: VoiceRecorderOpts = {}) {
    this.getNow = opts.getNow ?? (() => Date.now());
  }

  async start(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.stream = stream;
    this.mimeType = pickMimeType();
    this.chunks = [];
    const rec = this.mimeType
      ? new MediaRecorder(stream, { mimeType: this.mimeType })
      : new MediaRecorder(stream);
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder = rec;
    rec.start();
    this.startTs = this.getNow();
  }

  stop(): Promise<RecordingResult> {
    const rec = this.recorder;
    if (!rec) return Promise.reject(new Error("Recorder is not recording"));
    return new Promise<RecordingResult>((resolve) => {
      rec.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mimeType });
        const durationSec = (this.getNow() - this.startTs) / 1000;
        this.releaseStream();
        this.recorder = null;
        resolve({ blob, mimeType: this.mimeType, durationSec });
      };
      rec.stop();
    });
  }

  /** Отмена без обработки blob (закрытие листа / размонтирование). Безопасна до start(). */
  abort(): void {
    if (this.recorder) {
      this.recorder.onstop = null;
      this.recorder = null;
    }
    this.releaseStream();
    this.chunks = [];
  }

  private releaseStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }
}
