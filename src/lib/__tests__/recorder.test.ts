/**
 * TDD tests for src/lib/recorder.ts
 * RED phase: all tests fail until recorder.ts is implemented.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isSupported,
  pickMimeType,
  filenameForMime,
  isTooShort,
  isTooLarge,
  VoiceRecorder,
} from "../recorder";

// ── pickMimeType ─────────────────────────────────────────────────────────────

describe("pickMimeType", () => {
  it("returns highest-priority supported mime: audio/webm;codecs=opus", () => {
    // test-setup MockMediaRecorder.isTypeSupported supports all 4 types
    expect(pickMimeType()).toBe("audio/webm;codecs=opus");
  });

  it("falls back when top mime not supported", () => {
    const orig = (globalThis as Record<string, unknown>).MediaRecorder;
    (globalThis as Record<string, unknown>).MediaRecorder = {
      isTypeSupported: (m: string) => m === "audio/webm",
    };
    expect(pickMimeType()).toBe("audio/webm");
    (globalThis as Record<string, unknown>).MediaRecorder = orig;
  });

  it("falls back to mp4 when webm variants not supported", () => {
    const orig = (globalThis as Record<string, unknown>).MediaRecorder;
    (globalThis as Record<string, unknown>).MediaRecorder = {
      isTypeSupported: (m: string) => m === "audio/mp4",
    };
    expect(pickMimeType()).toBe("audio/mp4");
    (globalThis as Record<string, unknown>).MediaRecorder = orig;
  });

  it("falls back to ogg when only ogg supported", () => {
    const orig = (globalThis as Record<string, unknown>).MediaRecorder;
    (globalThis as Record<string, unknown>).MediaRecorder = {
      isTypeSupported: (m: string) => m === "audio/ogg;codecs=opus",
    };
    expect(pickMimeType()).toBe("audio/ogg;codecs=opus");
    (globalThis as Record<string, unknown>).MediaRecorder = orig;
  });

  it("returns empty string when no mime is supported", () => {
    const orig = (globalThis as Record<string, unknown>).MediaRecorder;
    (globalThis as Record<string, unknown>).MediaRecorder = {
      isTypeSupported: () => false,
    };
    expect(pickMimeType()).toBe("");
    (globalThis as Record<string, unknown>).MediaRecorder = orig;
  });

  it("returns empty string when MediaRecorder is not defined", () => {
    const orig = (globalThis as Record<string, unknown>).MediaRecorder;
    (globalThis as Record<string, unknown>).MediaRecorder = undefined;
    expect(pickMimeType()).toBe("");
    (globalThis as Record<string, unknown>).MediaRecorder = orig;
  });
});

// ── filenameForMime ──────────────────────────────────────────────────────────

describe("filenameForMime", () => {
  it("returns voice.webm for audio/webm;codecs=opus", () => {
    expect(filenameForMime("audio/webm;codecs=opus")).toBe("voice.webm");
  });

  it("returns voice.webm for audio/webm", () => {
    expect(filenameForMime("audio/webm")).toBe("voice.webm");
  });

  it("returns voice.mp4 for audio/mp4", () => {
    expect(filenameForMime("audio/mp4")).toBe("voice.mp4");
  });

  it("returns voice.ogg for audio/ogg;codecs=opus", () => {
    expect(filenameForMime("audio/ogg;codecs=opus")).toBe("voice.ogg");
  });

  it("returns voice.ogg for plain audio/ogg", () => {
    expect(filenameForMime("audio/ogg")).toBe("voice.ogg");
  });

  it("returns voice.webm for empty string (fallback)", () => {
    // Empty mime → default extension so backend always gets a filename
    expect(filenameForMime("")).toBe("voice.webm");
  });

  it("returns voice.webm for unknown mime", () => {
    expect(filenameForMime("audio/unknown")).toBe("voice.webm");
  });
});

// ── isSupported ──────────────────────────────────────────────────────────────

describe("isSupported", () => {
  it("returns true when MediaRecorder + getUserMedia + supported mime present", () => {
    // test-setup provides all three
    expect(isSupported()).toBe(true);
  });

  it("returns false when MediaRecorder is not defined", () => {
    const orig = (globalThis as Record<string, unknown>).MediaRecorder;
    (globalThis as Record<string, unknown>).MediaRecorder = undefined;
    expect(isSupported()).toBe(false);
    (globalThis as Record<string, unknown>).MediaRecorder = orig;
  });

  it("returns false when getUserMedia is not available", () => {
    const origNav = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", {
      value: { mediaDevices: {} },
      writable: true,
      configurable: true,
    });
    expect(isSupported()).toBe(false);
    Object.defineProperty(globalThis, "navigator", {
      value: origNav,
      writable: true,
      configurable: true,
    });
  });

  it("returns false when no mime type is supported", () => {
    const orig = (globalThis as Record<string, unknown>).MediaRecorder;
    (globalThis as Record<string, unknown>).MediaRecorder = {
      isTypeSupported: () => false,
    };
    expect(isSupported()).toBe(false);
    (globalThis as Record<string, unknown>).MediaRecorder = orig;
  });
});

// ── guard validators ─────────────────────────────────────────────────────────

describe("isTooShort", () => {
  it("returns true for blob with size 0", () => {
    const blob = new Blob([], { type: "audio/webm" });
    expect(isTooShort(blob, 0)).toBe(true);
  });

  it("returns true when durationSec < 0.5", () => {
    const blob = new Blob(["x"], { type: "audio/webm" });
    expect(isTooShort(blob, 0.4)).toBe(true);
  });

  it("returns true when durationSec exactly 0", () => {
    const blob = new Blob(["x"], { type: "audio/webm" });
    expect(isTooShort(blob, 0)).toBe(true);
  });

  it("returns false when size > 0 and durationSec >= 0.5", () => {
    const blob = new Blob(["audio data"], { type: "audio/webm" });
    expect(isTooShort(blob, 0.5)).toBe(false);
  });

  it("returns false for normal 3-second recording", () => {
    const blob = new Blob(["audio data"], { type: "audio/webm" });
    expect(isTooShort(blob, 3)).toBe(false);
  });
});

describe("isTooLarge", () => {
  const LIMIT_25MB = 25 * 1024 * 1024;

  it("returns false for blob exactly at 25 MB limit", () => {
    const blob = { size: LIMIT_25MB } as Blob;
    expect(isTooLarge(blob)).toBe(false);
  });

  it("returns true for blob one byte over 25 MB", () => {
    const blob = { size: LIMIT_25MB + 1 } as Blob;
    expect(isTooLarge(blob)).toBe(true);
  });

  it("returns false for small blob", () => {
    const blob = new Blob(["small"], { type: "audio/webm" });
    expect(isTooLarge(blob)).toBe(false);
  });

  it("returns true for very large blob (100 MB)", () => {
    const blob = { size: 100 * 1024 * 1024 } as Blob;
    expect(isTooLarge(blob)).toBe(true);
  });
});

// ── VoiceRecorder (integration) ──────────────────────────────────────────────

describe("VoiceRecorder", () => {
  let recorder: VoiceRecorder;
  // Injected clock: control Date.now() for deterministic durationSec
  let nowMs: number;

  beforeEach(() => {
    nowMs = 1_000_000;
    recorder = new VoiceRecorder({ getNow: () => nowMs });

    // Reset getUserMedia mock to fresh stream each test
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(
      (globalThis as Record<string, unknown>).__makeMockStream() as MediaStream
    );
  });

  it("start() calls getUserMedia with audio:true", async () => {
    await recorder.start();
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    // cleanup
    await recorder.abort();
  });

  it("stop() returns blob, mimeType, and durationSec", async () => {
    await recorder.start();
    // Advance clock by 3 seconds
    nowMs += 3000;
    const result = await recorder.stop();
    expect(result.blob).toBeInstanceOf(Blob);
    expect(result.mimeType).toBe("audio/webm;codecs=opus");
    expect(result.durationSec).toBeCloseTo(3, 1);
  });

  it("stop() stops all stream tracks (releases microphone)", async () => {
    const stream = (globalThis as Record<string, unknown>).__makeMockStream() as MediaStream;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(stream);

    await recorder.start();
    await recorder.stop();

    for (const track of stream.getTracks()) {
      expect(track.stop).toHaveBeenCalled();
    }
  });

  it("abort() stops tracks without resolving a blob", async () => {
    const stream = (globalThis as Record<string, unknown>).__makeMockStream() as MediaStream;
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(stream);

    await recorder.start();
    recorder.abort();

    for (const track of stream.getTracks()) {
      expect(track.stop).toHaveBeenCalled();
    }
  });

  it("abort() before start() does not throw", () => {
    expect(() => recorder.abort()).not.toThrow();
  });

  it("stop() before start() rejects with a clear error", async () => {
    await expect(recorder.stop()).rejects.toThrow(/not recording/i);
  });

  it("durationSec reflects real elapsed time from start to stop", async () => {
    nowMs = 5_000;
    await recorder.start();
    nowMs = 8_500; // 3.5 seconds later
    const { durationSec } = await recorder.stop();
    expect(durationSec).toBeCloseTo(3.5, 1);
  });
});
