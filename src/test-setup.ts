/**
 * Vitest test-setup: mock browser APIs absent in jsdom.
 * Loaded via vitest.config.ts → setupFiles.
 */

// ── MediaRecorder mock ───────────────────────────────────────────────────────

type MREventType = "dataavailable" | "stop" | "error" | "start";

const SUPPORTED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

class MockMediaRecorder {
  static isTypeSupported(mime: string): boolean {
    return SUPPORTED_MIME_TYPES.includes(mime);
  }

  mimeType: string;
  state: "inactive" | "recording" | "paused" = "inactive";

  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((e: Event) => void) | null = null;

  private _listeners: Map<MREventType, Array<(e: unknown) => void>> = new Map();

  constructor(
    _stream: MediaStream,
    options?: { mimeType?: string }
  ) {
    this.mimeType = options?.mimeType ?? "";
  }

  start(): void {
    this.state = "recording";
  }

  stop(): void {
    this.state = "inactive";
    // Emit dataavailable with a small blob then stop
    const blob = new Blob(["audio-data"], { type: this.mimeType });
    if (this.ondataavailable) {
      this.ondataavailable({ data: blob });
    }
    if (this.onstop) {
      this.onstop();
    }
    this._emit("stop", undefined);
  }

  addEventListener(type: MREventType, listener: (e: unknown) => void): void {
    const existing = this._listeners.get(type) ?? [];
    this._listeners.set(type, [...existing, listener]);
  }

  private _emit(type: MREventType, event: unknown): void {
    const listeners = this._listeners.get(type) ?? [];
    for (const fn of listeners) fn(event);
  }
}

// Attach to global so recorder.ts can use it
(globalThis as Record<string, unknown>).MediaRecorder = MockMediaRecorder;

// ── navigator.mediaDevices.getUserMedia mock ─────────────────────────────────

function makeMockStream(): MediaStream {
  const track: MediaStreamTrack = {
    stop: vi.fn(),
    kind: "audio",
    id: "mock-track-id",
    label: "mock-audio",
    enabled: true,
    muted: false,
    readyState: "live",
    onended: null,
    onmute: null,
    onunmute: null,
    clone: () => track,
    getCapabilities: () => ({} as MediaTrackCapabilities),
    getConstraints: () => ({}),
    getSettings: () => ({} as MediaTrackSettings),
    applyConstraints: () => Promise.resolve(),
    dispatchEvent: () => false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaStreamTrack;

  const stream: MediaStream = {
    getTracks: () => [track],
    getAudioTracks: () => [track],
    getVideoTracks: () => [],
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    getTrackById: () => null,
    clone: () => stream,
    id: "mock-stream-id",
    active: true,
    onaddtrack: null,
    onremovetrack: null,
    dispatchEvent: () => false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaStream;

  return stream;
}

// Expose factory so individual tests can get the mock track for assertions
(globalThis as Record<string, unknown>).__makeMockStream = makeMockStream;

Object.defineProperty(globalThis, "navigator", {
  value: {
    ...globalThis.navigator,
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue(makeMockStream()),
      enumerateDevices: vi.fn().mockResolvedValue([]),
    },
  },
  writable: true,
  configurable: true,
});
