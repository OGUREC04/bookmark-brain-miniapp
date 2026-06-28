// API client for BookmarkBrain backend
// Updated 2026-05-15 (T1): retry-on-401, in-flight auth dedup, AuthExpiredError signal for UI.

import { getInitData } from "./telegram";

let authToken: string | null = null;
let authInFlight: Promise<string> | null = null;

/**
 * Thrown when re-auth via initData fails (TG initData TTL ~24h expires
 * during long-lived WebViews). UI should show a full-screen CTA to
 * restart Mini App from the bot.
 */
export class AuthExpiredError extends Error {
  constructor(message = "Сессия истекла. Перезапусти Mini App из бота.") {
    super(message);
    this.name = "AuthExpiredError";
  }
}

async function fetchNewToken(): Promise<string> {
  // DEV-only fallback: when running in a plain browser (no Telegram client),
  // allow headless E2E to inject init_data via localStorage. The backend will
  // ONLY accept this if its triple-gated DEV_AUTH_BYPASS is on; in prod this
  // path is harmless because the backend rejects every "dev:" init_data.
  let initData = getInitData();
  if (!initData && typeof localStorage !== "undefined") {
    initData = localStorage.getItem("__dev_init_data") ?? "";
  }
  if (!initData) {
    throw new AuthExpiredError("No Telegram initData available");
  }
  const res = await fetch("/api/v1/auth/telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ init_data: initData }),
  });
  if (!res.ok) {
    throw new AuthExpiredError("Auth failed");
  }
  const data = await res.json();
  authToken = data.access_token;
  return authToken!;
}

/**
 * Returns a cached JWT or fetches a fresh one.
 * Deduplicates concurrent auth requests so parallel callers share one POST.
 */
async function getToken(): Promise<string> {
  if (authToken) return authToken;
  if (authInFlight) return authInFlight;
  authInFlight = fetchNewToken().finally(() => {
    authInFlight = null;
  });
  return authInFlight;
}

async function doFetch(path: string, options: RequestInit, token: string): Promise<Response> {
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}

/**
 * Общий цикл авторизованного запроса: токен → fetch → retry-on-401 → разбор ошибки.
 * `fetcher` сам решает, какие заголовки слать: JSON-вызовы ставят Content-Type через doFetch,
 * multipart — НЕ ставит (чтобы браузер сам проставил multipart/form-data + boundary).
 */
async function withAuth<T>(fetcher: (token: string) => Promise<Response>): Promise<T> {
  let token = await getToken();
  let res = await fetcher(token);

  // Retry once on 401: clear cached token, request a fresh one, replay.
  if (res.status === 401) {
    authToken = null;
    token = await getToken(); // initData отвергнут → AuthExpiredError пробрасывается в UI
    res = await fetcher(token);
    if (res.status === 401) {
      throw new AuthExpiredError(); // всё ещё 401 после свежей авторизации — initData мёртв
    }
  }

  if (res.status === 204) return undefined as T;
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

// JSON-запрос (Content-Type: application/json выставляет doFetch).
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  return withAuth<T>((token) => doFetch(path, options, token));
}

/**
 * Multipart-запрос: вызывает fetch НАПРЯМУЮ (НЕ doFetch) и НЕ ставит Content-Type —
 * иначе хардкод application/json из doFetch перебил бы boundary FormData, и бэк не распарсил бы файл.
 */
async function requestRaw<T>(path: string, body: FormData, method = "POST"): Promise<T> {
  return withAuth<T>((token) =>
    fetch(path, { method, body, headers: { Authorization: `Bearer ${token}` } }),
  );
}

// Types
export interface Tag {
  id: string;
  name: string;
  color: string | null;
  bookmarks_count: number;
}

export interface Bookmark {
  id: string;
  user_id: string;
  source: string;
  url: string | null;
  raw_text: string;
  title: string | null;
  content_type: string;
  summary: string | null;
  category: string | null;
  tags: Tag[];
  folder_id: string | null;
  ai_status: string;
  is_favorite: boolean;
  is_archived: boolean;
  created_at: string;
  updated_at: string;

  // Phase 1 — deep processing
  item_type?: string | null;
  takeaway?: string | null;
  key_ideas?: string[] | null;
  entities?: string[] | null;
  open_questions?: string[] | null;

  // Phase 2 — structured content
  structured_data?: TaskListData | null;

  // Voice/media (тикет ti0): transcription есть в схеме бэка; ai_error пока НЕ в ответе бэка —
  // в UI на него НЕ полагаемся (показываем общий текст ошибки), поле задел на будущее.
  transcription?: string | null;
  ai_error?: string | null;
}

export interface TaskItem {
  /** Клиентский стабильный ключ для React (бэк хранит structured_data verbatim,
   *  лишнее поле игнорирует). Бэкфилл при загрузке — см. TaskListEditor. */
  id?: string;
  text: string;
  done: boolean;
  deadline: string | null;
}

export interface TaskListData {
  type: "task_list";
  tasks: TaskItem[];
}

export interface Folder {
  id: string;
  name: string;
  emoji: string | null;
  bookmarks_count: number;
  created_at: string;
}

export interface BookmarkList {
  items: Bookmark[];
  total: number;
  page: number;
  per_page: number;
}

export interface SearchResult {
  bookmark: Bookmark;
  score: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  // AI-саммари по топу результатов с маркерами [1]..[N]
  summary: string | null;
}

/** Режим поиска (Connections FR-7): обычный гибрид vs по смыслу. */
export type SearchMode = "hybrid" | "semantic";

// ─── Connections (Phase 5A) — зеркалят бэкенд, контракты проверены вживую.
//     См. docs/prd/CONNECTIONS-MINIAPP.md (монорепо). ───

/** Похожая заметка (секция «Связано»). `weight` — сила связи. */
export interface RelatedItem {
  id: string;
  title: string | null;
  summary: string | null;
  item_type: string | null;
  weight: number;
  created_at: string | null;
}

export interface RelatedResponse {
  items: RelatedItem[];
  total: number; // истинное число связей (для бейджа «Связано (N)»)
}

export interface GraphNode {
  id: string;
  title: string | null;
  item_type: string | null;
}

/** Ребро графа В ФОРМАТЕ БЭКА (`from`/`to`). В формат либы графа
 *  (`source`/`target`) преобразует ТОЛЬКО adapters.graphDataOf(). */
export interface GraphEdge {
  from: string;
  to: string;
  weight: number;
}

/** Координаты узла из клиентской раскладки (force-симуляция → кэш на бэке). */
export interface GraphLayoutNode {
  id: string;
  x: number;
  y: number;
}

/** Полный граф. `layout` = кэш координат или null (надо считать клиенту). */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout: GraphLayoutNode[] | null;
  stale: boolean; // true → раскладка устарела, пора пересобрать
  node_count: number;
  built_at: string | null;
}

export interface GraphBuildResponse {
  node_count: number;
  saved: boolean;
}

export interface UserInfo {
  id: string;
  telegram_id: number;
  telegram_username: string | null;
  telegram_first_name: string | null;
  bookmarks_count: number;
  created_at: string;
}

// Reminders (T5 / Phase 2.5 endpoints, B1 added bookmark_title/raw_text)

export interface Reminder {
  id: string;
  bookmark_id: string | null;
  kind: string;
  fire_at: string;
  status: string;
  payload: Record<string, unknown>;
  created_at: string;
  sent_at: string | null;
  bookmark_title: string | null;
  bookmark_raw_text: string | null;
}

export interface RemindersList {
  items: Reminder[];
  total: number;
}

// Recurring reminders (/repeat, MVP = daily). Зеркалят бэк (api/recurring.py, schemas RecurringResponse).
export interface Recurring {
  id: string;
  text: string;
  rule: string; // пока всегда "daily"
  hour: number;
  minute: number;
  next_fire_at: string;
  active: boolean;
  created_at: string;
  deduplicated?: boolean; // true → бэк вернул существующую серию вместо дубля
}

export interface RecurringList {
  items: Recurring[];
  total: number;
}

// ─── Note entries (заметка-как-диалог, B2/B4). Плоская схема — зеркалит backend
//     EntryResponse (backend/app/schemas.py). Контракт заморожен в B2 (DEC-4):
//     голосовые поля на верхнем уровне, без вложенного voice{}. ───

/** Вид записи лога. В MVP всегда "user" (Brain молчит); "brain"/"system" — задел на будущее. */
export type EntryKind = "user" | "brain" | "system";

/** Статус распознавания ГОЛОСОВОЙ дописки (B4) — на уровне записи, не всей заметки. */
export type EntryAiStatus = "transcribing" | "done" | "failed";

/** Дописка («сообщение») в логе заметки. Текст — body; голос несёт transcription/duration. */
export interface Entry {
  id: string;
  kind: EntryKind;
  body: string;
  created_at: string;
  edited_at: string | null;
  // Голос (B4): заполняются воркером после STT. Для текстовых дописок — отсутствуют/null.
  transcription?: string | null;
  duration?: number | null;
  entry_ai_status?: EntryAiStatus | null;
}

/** Лента дописок заметки (GET .../thread). Без пагинации в MVP (DEC-6). */
export interface Thread {
  entries: Entry[];
  total: number;
}

export interface BookmarkListParams {
  page?: number;
  perPage?: number;
  isFavorite?: boolean;
  isArchived?: boolean;
  itemType?: string; // B2
  category?: string;
}

// API methods

export const api = {
  getBookmarks(params: BookmarkListParams = {}): Promise<BookmarkList> {
    const { page = 1, perPage = 20, isFavorite, isArchived, itemType, category } = params;
    const qs = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    if (isFavorite !== undefined) qs.set("is_favorite", String(isFavorite));
    if (isArchived !== undefined) qs.set("is_archived", String(isArchived));
    if (itemType) qs.set("item_type", itemType);
    if (category) qs.set("category", category);
    return request(`/api/v1/bookmarks/?${qs.toString()}`);
  },

  createThought(text: string): Promise<Bookmark> {
    // POST /bookmarks/ — source='miniapp', enqueue worker для classify/embed/tags
    return request("/api/v1/bookmarks/", {
      method: "POST",
      body: JSON.stringify({ source: "miniapp", raw_text: text }),
    });
  },

  /** Голосовой ввод (тикет ti0, фаза 1): загрузка аудио из Mini App. Возвращает заметку
   *  с ai_status="transcribing" (дальше поллинг по ai_status). filename ОБЯЗАТЕЛЕН —
   *  бэк определяет формат и нужен ли транскод по суффиксу. Multipart через requestRaw. */
  uploadMedia(
    file: Blob,
    opts: {
      kind?: "audio" | "document";
      caption?: string;
      duration?: number;
      title?: string;
      filename?: string;
    } = {},
  ): Promise<Bookmark> {
    const fd = new FormData();
    fd.append("file", file, opts.filename ?? "voice.webm");
    if (opts.kind) fd.append("kind", opts.kind);
    if (opts.caption) fd.append("caption", opts.caption);
    if (opts.duration !== undefined) fd.append("duration", String(opts.duration));
    if (opts.title) fd.append("title", opts.title);
    return requestRaw<Bookmark>("/api/v1/bookmarks/upload", fd);
  },

  getBookmark(id: string): Promise<Bookmark> {
    return request(`/api/v1/bookmarks/${id}`);
  },

  deleteBookmark(id: string): Promise<void> {
    return request(`/api/v1/bookmarks/${id}`, { method: "DELETE" });
  },

  toggleFavorite(id: string, isFavorite: boolean): Promise<Bookmark> {
    return request(`/api/v1/bookmarks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_favorite: isFavorite }),
    });
  },

  search(query: string, limit = 20, mode?: SearchMode): Promise<SearchResponse> {
    return request("/api/v1/search/", {
      method: "POST",
      body: JSON.stringify({ query, limit, ...(mode ? { mode } : {}) }),
    });
  },

  // ─── Connections (Phase 5A) — docs/prd/CONNECTIONS-MINIAPP.md ───

  /** Похожие заметки (секция «Связано»). all=true → все связи, иначе топ-limit. */
  getRelated(bookmarkId: string, limit = 5, all = false): Promise<RelatedResponse> {
    // При all=true бэк ИГНОРИРУЕТ limit и отдаёт все связи, но всё равно валидирует
    // limit ≤ 50 — поэтому при all НЕ шлём его (раньше слали 100 → 422 → «Посмотреть
    // все» отдавала пустую шторку и чип «N связей» исчезал).
    const qs = new URLSearchParams({ all: String(all) });
    if (!all) qs.set("limit", String(limit));
    return request(`/api/v1/bookmarks/${bookmarkId}/related?${qs.toString()}`);
  },

  /** Полный граф + кэш раскладки (layout=null → считать клиенту). */
  getGraph(): Promise<GraphData> {
    return request("/api/v1/graph");
  },

  /** Сохранить раскладку, посчитанную клиентом (≤350 узлов). */
  buildGraph(nodes: GraphLayoutNode[]): Promise<GraphBuildResponse> {
    return request("/api/v1/graph/build", {
      method: "POST",
      body: JSON.stringify({ nodes }),
    });
  },

  getMe(): Promise<UserInfo> {
    return request("/api/v1/users/me");
  },

  getTags(): Promise<Tag[]> {
    return request("/api/v1/search/tags");
  },

  // Folders
  getFolders(): Promise<Folder[]> {
    return request("/api/v1/folders/");
  },

  createFolder(name: string, emoji?: string): Promise<Folder> {
    return request("/api/v1/folders/", {
      method: "POST",
      body: JSON.stringify({ name, emoji }),
    });
  },

  deleteFolder(id: string): Promise<void> {
    return request(`/api/v1/folders/${id}`, { method: "DELETE" });
  },

  getFolderBookmarks(folderId: string, page = 1, perPage = 20): Promise<BookmarkList> {
    return request(`/api/v1/folders/${folderId}/bookmarks?page=${page}&per_page=${perPage}`);
  },

  addBookmarkToFolder(folderId: string, bookmarkId: string): Promise<void> {
    return request(`/api/v1/folders/${folderId}/bookmarks/${bookmarkId}`, { method: "POST" });
  },

  removeBookmarkFromFolder(folderId: string, bookmarkId: string): Promise<void> {
    return request(`/api/v1/folders/${folderId}/bookmarks/${bookmarkId}`, { method: "DELETE" });
  },

  updateBookmark(
    id: string,
    data: Partial<{
      folder_id: string | null;
      is_favorite: boolean;
      is_archived: boolean;
      title: string;
      structured_data: TaskListData | null;
      // FLAGS.TEXT_EDIT — тело текста заметки (тикет 0rn). Бэк должен принять raw_text
      // в BookmarkUpdate и выставить ai_status при переобработке (см. бриф BOOKMARK-TEXT-EDIT).
      raw_text: string;
    }>
  ): Promise<Bookmark> {
    return request(`/api/v1/bookmarks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  /** FLAGS.TEXT_EDIT — правка тела текста заметки (тикет 0rn). Тонкая обёртка над PATCH. */
  updateBookmarkText(id: string, rawText: string): Promise<Bookmark> {
    return request(`/api/v1/bookmarks/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ raw_text: rawText }),
    });
  },

  // Reminders (Phase 2.5 + B1 bookmark fields)
  reminders: {
    upcoming(limit = 50): Promise<RemindersList> {
      return request(`/api/v1/reminders/upcoming?limit=${limit}`);
    },
    history(limit = 20, days = 30): Promise<RemindersList> {
      return request(`/api/v1/reminders/history?limit=${limit}&days=${days}`);
    },
    create(
      bookmarkId: string | null,
      fireAt: string,
      payload?: Record<string, unknown>
    ): Promise<Reminder> {
      return request("/api/v1/reminders/", {
        method: "POST",
        body: JSON.stringify({
          bookmark_id: bookmarkId,
          fire_at: fireAt,
          ...(payload ? { payload } : {}),
        }),
      });
    },
    snooze(id: string, fireAt: string): Promise<Reminder> {
      return request(`/api/v1/reminders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ fire_at: fireAt }),
      });
    },
    /**
     * FLAGS.TEXT_EDIT — перенос + правка текста (тикет 8uu). Шлёт fire_at и/или text.
     * Бэк должен принять `text` в ReminderUpdate и записать в payload.text
     * (см. бриф REMINDER-TEXT-EDIT). До контракта — не вызывается (флаг off).
     */
    update(id: string, data: { fireAt?: string; text?: string }): Promise<Reminder> {
      return request(`/api/v1/reminders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...(data.fireAt ? { fire_at: data.fireAt } : {}),
          ...(data.text !== undefined ? { text: data.text } : {}),
        }),
      });
    },
    cancel(id: string): Promise<void> {
      return request(`/api/v1/reminders/${id}`, { method: "DELETE" });
    },
  },

  // Регулярные (ежедневные) напоминания. Mini App шлёт СТРУКТУРНО (text+hour+minute) —
  // бэк НЕ парсит (парсер остался для бот-команды /repeat). Так слова расписания внутри
  // текста («полить цветы каждый день») не искажают серию. См. docs/BACKEND-CONTEXT-miniapp.md.
  recurring: {
    list(): Promise<RecurringList> {
      return request("/api/v1/recurring/");
    },
    create(text: string, hour: number, minute: number): Promise<Recurring> {
      return request("/api/v1/recurring/", {
        method: "POST",
        body: JSON.stringify({ text: text.trim(), rule: "daily", hour, minute }),
      });
    },
    stop(id: string): Promise<void> {
      return request(`/api/v1/recurring/${id}`, { method: "DELETE" });
    },
  },

  // ─── Note entries (заметка-как-диалог). Лог дописок к заметке. Бэк: app/api/entries.py.
  //     Brain молчит (kind='user'); голос-дописка распознаётся воркером (entry_ai_status). ───
  entries: {
    /** Лента дописок заметки — неудалённые, по времени (старое → новое). Без пагинации (MVP). */
    list(bookmarkId: string): Promise<Thread> {
      return request(`/api/v1/bookmarks/${bookmarkId}/thread`);
    },
    /** Добавить текстовую дописку (kind='user'). */
    create(bookmarkId: string, body: string): Promise<Entry> {
      return request(`/api/v1/bookmarks/${bookmarkId}/entries`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
    },
    /** Править дописку (бэк ставит edited_at). */
    edit(bookmarkId: string, entryId: string, body: string): Promise<Entry> {
      return request(`/api/v1/bookmarks/${bookmarkId}/entries/${entryId}`, {
        method: "PATCH",
        body: JSON.stringify({ body }),
      });
    },
    /** Мягко удалить дописку (бэк ставит is_deleted). */
    remove(bookmarkId: string, entryId: string): Promise<void> {
      return request(`/api/v1/bookmarks/${bookmarkId}/entries/${entryId}`, {
        method: "DELETE",
      });
    },
    /** Голосовая дописка (B4): загрузка аудио. Возвращает запись entry_ai_status='transcribing'
     *  — дальше ОТДЕЛЬНЫЙ поллинг GET thread пока есть transcribing (DEC-11). Multipart (как uploadMedia):
     *  filename нужен бэку для определения формата/транскода по суффиксу. */
    upload(
      bookmarkId: string,
      file: Blob,
      opts: { duration?: number; filename?: string } = {},
    ): Promise<Entry> {
      const fd = new FormData();
      fd.append("file", file, opts.filename ?? "voice.webm");
      if (opts.duration !== undefined) fd.append("duration", String(opts.duration));
      return requestRaw<Entry>(`/api/v1/bookmarks/${bookmarkId}/entries/upload`, fd);
    },
  },
};
