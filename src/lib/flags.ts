/* Фиче-флаги фронта. Включать ТОЛЬКО когда готов соответствующий бэк-контракт
   И он задеплоен на прод — иначе UI «врёт» (вызовы 404 / правка молча теряется).
   Для локального теста флаги можно временно поставить true (не коммитить true). */

export const FLAGS = {
  /**
   * Inline-редактирование текста заметок и текста напоминаний.
   * Бэк реализован и покрыт тестами (подтверждено backend-сессией 2026-06-21):
   *   - напоминание: PATCH /api/v1/reminders/{id} с полем `text` (8uu)
   *   - заметка: PATCH /api/v1/bookmarks/{id} с `raw_text` + materiality-gate 0.85 (0rn)
   * ПРОДА НЕТ → включено для дева (true).
   * Брифы: bookmark-brain/docs/prd/REMINDER-TEXT-EDIT.md, BOOKMARK-TEXT-EDIT.md.
   */
  TEXT_EDIT: true,

  /**
   * Связи между заметками (Connections, Phase 5A): секция «Связано», таб «Граф»,
   * семантический режим поиска. Бэк-слой связей в main. ПРОДА НЕТ → включено для дева (true).
   * ⚠️ Рёбра строит backfill_bookmark_links на бэке — если граф пустой, прогнать его на деве.
   * Бриф: bookmark-brain/docs/prd/CONNECTIONS-MINIAPP.md.
   */
  CONNECTIONS: true,

  /**
   * Пространства (Spaces) — фича не готова. Скрывает таб «Пространства» и пункт
   * «В пространство» в шторке действий. Включить, когда фича будет доделана.
   */
  SPACES: false,

  /**
   * Голосовой ввод в Mini App (тикет ti0): кнопка 🎤 в ComposeScreen, запись через
   * MediaRecorder → POST /bookmarks/upload. Бэк (3sr/бт-12) в main; дев-инфра готова —
   * Yandex S3 `bookmarkbrain-stt` + Yandex STT (те же, что у бота) + ffmpeg в воркере.
   * ПРОДА НЕТ → включено для дева (true) с 2026-06-18.
   * Бриф: bookmark-brain/docs/prd/MINIAPP-MEDIA-UPLOAD.md.
   */
  VOICE_UPLOAD: true,

  /**
   * Заметка-как-диалог (Notes as Conversations): лента дописок в DetailScreen
   * чат-бабблами. Бэк B1–B4 в main (entries CRUD + голос-в-дописку + classify-free
   * re-index). Фронт в процессе: F3a (лента read-only) готова, композер (F3b) и
   * голос-дописка (F3d) — нет → пока OFF, вливаем «тёмным». Включить, когда лента
   * станет полноценной (можно дописывать).
   * Эпик: bookmark-brain/docs/prd/NOTES-AS-CONVERSATIONS-EPIC.md.
   */
  NOTES_LOG: false,
} as const;
