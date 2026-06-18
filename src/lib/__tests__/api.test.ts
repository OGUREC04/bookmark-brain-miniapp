/**
 * TDD tests for api.uploadMedia (тикет ti0).
 * Главное, что защищаем: multipart БЕЗ Content-Type: application/json
 * (иначе теряется boundary и бэк не распарсит файл) + имя файла в FormData.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// initData для getToken (иначе AuthExpiredError ещё до запроса).
vi.mock("../telegram", () => ({ getInitData: () => "dev:test-init" }));

import { api, AuthExpiredError } from "../api";

function bookmarkStub(overrides: Record<string, unknown> = {}) {
  return {
    id: "bm-1", user_id: "u1", source: "miniapp", url: null, raw_text: "",
    title: null, content_type: "voice", summary: null, category: null, tags: [],
    folder_id: null, ai_status: "transcribing", is_favorite: false, is_archived: false,
    created_at: "2026-06-17T00:00:00Z", updated_at: "2026-06-17T00:00:00Z", ...overrides,
  };
}

function jsonRes(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

let uploadCalls: { url: string; init: RequestInit }[];
let uploadResponder: () => Response;

beforeEach(() => {
  uploadCalls = [];
  uploadResponder = () => jsonRes(201, bookmarkStub());
  let authN = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: unknown, init: RequestInit = {}) => {
      const u = String(url);
      if (u.includes("/auth/telegram")) {
        return Promise.resolve(jsonRes(200, { access_token: `tok-${++authN}` }));
      }
      if (u.includes("/bookmarks/upload")) {
        uploadCalls.push({ url: u, init });
        return Promise.resolve(uploadResponder());
      }
      return Promise.resolve(jsonRes(404, { detail: "unexpected url" }));
    }),
  );
});

describe("api.uploadMedia", () => {
  it("POSTs multipart to /bookmarks/upload with file under 'file' WITH a filename", async () => {
    const blob = new Blob(["audio"], { type: "audio/webm" });
    await api.uploadMedia(blob, { kind: "audio", filename: "voice.webm" });

    const call = uploadCalls.at(-1)!;
    expect(call.url).toContain("/api/v1/bookmarks/upload");
    expect(call.init.method).toBe("POST");
    const body = call.init.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    const file = body.get("file") as File;
    expect(file).toBeTruthy();
    expect(file.name).toBe("voice.webm"); // имя обязательно — бэк маршрутизирует по суффиксу
  });

  it("does NOT set Content-Type: application/json (boundary must survive)", async () => {
    const blob = new Blob(["audio"], { type: "audio/webm" });
    await api.uploadMedia(blob, { filename: "voice.webm" });

    const headers = (uploadCalls.at(-1)!.init.headers ?? {}) as Record<string, string>;
    const ct = headers["Content-Type"] ?? headers["content-type"];
    expect(ct).toBeUndefined();
    expect(headers["Authorization"]).toMatch(/^Bearer /);
  });

  it("appends kind/caption/duration/title only when provided", async () => {
    const blob = new Blob(["audio"], { type: "audio/webm" });
    await api.uploadMedia(blob, { filename: "voice.webm", caption: "привет", duration: 3.2 });

    const body = uploadCalls.at(-1)!.init.body as FormData;
    expect(body.get("caption")).toBe("привет");
    expect(body.get("duration")).toBe("3.2");
    expect(body.get("kind")).toBeNull();
    expect(body.get("title")).toBeNull();
  });

  it("returns the created Bookmark (ai_status=transcribing)", async () => {
    const blob = new Blob(["audio"], { type: "audio/webm" });
    const bm = await api.uploadMedia(blob, { filename: "voice.webm" });
    expect(bm.ai_status).toBe("transcribing");
    expect(bm.content_type).toBe("voice");
  });

  it("throws Error with backend detail on 413 (too large)", async () => {
    uploadResponder = () => jsonRes(413, { detail: "Файл слишком большой (максимум 25 МБ)." });
    const blob = new Blob(["audio"], { type: "audio/webm" });
    await expect(api.uploadMedia(blob, { filename: "voice.webm" })).rejects.toThrow(/слишком большой/);
  });

  it("retries once on 401 then succeeds", async () => {
    let n = 0;
    uploadResponder = () => (++n === 1 ? jsonRes(401, { detail: "unauth" }) : jsonRes(201, bookmarkStub()));
    const blob = new Blob(["audio"], { type: "audio/webm" });
    const bm = await api.uploadMedia(blob, { filename: "voice.webm" });
    expect(bm.id).toBe("bm-1");
    expect(uploadCalls.length).toBe(2); // первый 401 + повтор после ре-аутентификации
  });

  it("throws AuthExpiredError when 401 persists after re-auth", async () => {
    uploadResponder = () => jsonRes(401, { detail: "unauth" });
    const blob = new Blob(["audio"], { type: "audio/webm" });
    await expect(api.uploadMedia(blob, { filename: "voice.webm" })).rejects.toBeInstanceOf(AuthExpiredError);
  });
});
